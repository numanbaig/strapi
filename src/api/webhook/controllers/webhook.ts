import crypto from 'crypto';
import { sendBookingConfirmationEmail, sendFollowUpEmail } from '../../../services/mailgun';
import { createLeadInCrm } from '../../../services/twenty-crm';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET || !signature) return !WEBHOOK_SECRET;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export default {
  /**
   * POST /api/webhooks/booking
   * Receives Cal.com booking webhook payloads.
   */
  async handleBooking(ctx) {
    const rawBody = JSON.stringify(ctx.request.body);
    const signature = ctx.request.headers['x-cal-signature'] as string | undefined;

    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid webhook signature' };
      return;
    }

    const body = ctx.request.body as any;
    const payload = body.payload || body;

    const attendee = payload.attendees?.[0] || {};
    const name = attendee.name || payload.name || 'Unknown';
    const email = attendee.email || payload.email || '';
    const startTime = payload.startTime || payload.start_time || '';
    const meetingLink =
      payload.metadata?.videoCallUrl ||
      payload.meetingUrl ||
      payload.meeting_url ||
      '';

    if (!email) {
      ctx.status = 400;
      ctx.body = { error: 'Missing attendee email' };
      return;
    }

    const dateObj = new Date(startTime);
    const date = dateObj.toISOString().split('T')[0];
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}.000`;

    try {
      const booking = await strapi.documents('api::booking.booking').create({
        data: {
          name,
          email,
          date,
          time,
          meetingLink,
          syncedToCrm: false,
        },
      });

      strapi.log.info(`Booking created for ${email} on ${date} at ${time}`);

      // TODO: Uncomment when Mailgun keys are configured
      // try {
      //   await sendBookingConfirmationEmail({ to: email, name, date, time, meetingLink });
      //   strapi.log.info(`Booking confirmation email sent to ${email}`);
      // } catch (err) {
      //   strapi.log.error(`Failed to send booking confirmation email:`, err);
      // }

      try {
        const crmResult = await createLeadInCrm({
          name,
          email,
          source: 'cal_booking',
        });

        if (crmResult?.id) {
          const existingLead = await strapi.documents('api::lead.lead').findMany({
            filters: { email },
            limit: 1,
          });

          if (existingLead.length > 0) {
            await strapi.documents('api::lead.lead').update({
              documentId: existingLead[0].documentId,
              data: { crmId: crmResult.id },
            });
          } else {
            await strapi.documents('api::lead.lead').create({
              data: {
                name,
                email,
                source: 'cal_booking',
                status: 'new',
                crmId: crmResult.id,
              },
            });
          }

          await strapi.documents('api::booking.booking').update({
            documentId: booking.documentId,
            data: { syncedToCrm: true },
          });

          strapi.log.info(`Booking lead synced to CRM: ${crmResult.id}`);
        }
      } catch (err) {
        strapi.log.error(`Failed to sync booking lead to CRM:`, err);
      }

      ctx.status = 200;
      ctx.body = { message: 'Booking processed successfully', bookingId: booking.documentId };
    } catch (err) {
      strapi.log.error('Failed to process booking webhook:', err);
      ctx.status = 500;
      ctx.body = { error: 'Internal server error' };
    }
  },

  /**
   * POST /api/webhooks/crm
   * Receives Twenty CRM webhook payloads for stage changes and deal updates.
   */
  async handleCrm(ctx) {
    const rawBody = JSON.stringify(ctx.request.body);
    const signature = ctx.request.headers['x-webhook-signature'] as string | undefined;

    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid webhook signature' };
      return;
    }

    const body = ctx.request.body as any;
    const eventType = body.event || body.type || '';
    const record = body.data || body.record || {};
    const crmId = record.id || '';

    if (!crmId) {
      ctx.status = 400;
      ctx.body = { error: 'Missing record ID' };
      return;
    }

    try {
      const leads = await strapi.documents('api::lead.lead').findMany({
        filters: { crmId },
        limit: 1,
      });

      if (leads.length === 0) {
        strapi.log.warn(`No local lead found for CRM ID: ${crmId}`);
        ctx.status = 200;
        ctx.body = { message: 'No matching lead found, event acknowledged' };
        return;
      }

      const lead = leads[0];

      if (eventType.includes('stage') || eventType.includes('update')) {
        const newStage = record.stage || record.status || '';

        if (newStage) {
          type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
          const validStatuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];
          const normalized = newStage.toLowerCase();
          const mappedStatus = validStatuses.find((s) => s === normalized);

          if (mappedStatus) {
            await strapi.documents('api::lead.lead').update({
              documentId: lead.documentId,
              data: { status: mappedStatus },
            });
          }
        }

        // TODO: Uncomment when Mailgun keys are configured
        // try {
        //   await sendFollowUpEmail({
        //     to: lead.email,
        //     name: lead.name,
        //     stage: newStage || eventType,
        //   });
        //   strapi.log.info(`Follow-up email sent to ${lead.email} for stage: ${newStage}`);
        // } catch (err) {
        //   strapi.log.error(`Failed to send follow-up email:`, err);
        // }
      }

      ctx.status = 200;
      ctx.body = { message: 'CRM event processed successfully' };
    } catch (err) {
      strapi.log.error('Failed to process CRM webhook:', err);
      ctx.status = 500;
      ctx.body = { error: 'Internal server error' };
    }
  },
};
