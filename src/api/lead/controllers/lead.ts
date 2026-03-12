import { factories } from '@strapi/strapi';
import { sendLeadAcknowledgmentEmail } from '../../../services/mailgun';
import { createLeadInCrm } from '../../../services/twenty-crm';

export default factories.createCoreController('api::lead.lead', ({ strapi }) => ({
  async waitlist(ctx) {
    const body = ctx.request.body as Record<string, unknown>;
    const data = (body?.data && typeof body.data === 'object' && body.data !== null
      ? body.data
      : body) as { name?: string; email?: string };
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';

    if (!name || !email) {
      return ctx.badRequest('Name and email are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ctx.badRequest('Invalid email address');
    }

    const existingLead = await strapi.db.query('api::lead.lead').findOne({
      where: { email },
    });

    if (existingLead) {
      return ctx.badRequest('Email already registered on waitlist');
    }

    const lead = await strapi.documents('api::lead.lead').create({
      data: {
        name,
        email,
        source: 'waitlist',
        status: 'new',
      },
    });

    try {
      const crmResult = await createLeadInCrm({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
      });

      if (crmResult?.id) {
        await strapi.documents('api::lead.lead').update({
          documentId: lead.documentId,
          data: { crmId: crmResult.id },
        });
        strapi.log.info(`Waitlist lead synced to CRM with ID: ${crmResult.id}`);
      }
    } catch (err) {
      strapi.log.error(`Failed to sync waitlist lead to CRM for ${lead.email}:`, err);
    }

    return ctx.send({
      data: { id: lead.documentId, name: lead.name, email: lead.email },
      ok: true,
    });
  },

  async create(ctx) {
    const response = await super.create(ctx);
    const lead = response.data;

    // TODO: Uncomment when Mailgun keys are configured
    // try {
    //   await sendLeadAcknowledgmentEmail({
    //     to: lead.email,
    //     name: lead.name,
    //   });
    //   strapi.log.info(`Acknowledgment email sent to ${lead.email}`);
    // } catch (err) {
    //   strapi.log.error(`Failed to send acknowledgment email to ${lead.email}:`, err);
    // }

    try {
      const crmResult = await createLeadInCrm({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
      });

      if (crmResult?.id) {
        await strapi.documents('api::lead.lead').update({
          documentId: lead.documentId,
          data: { crmId: crmResult.id },
        });
        strapi.log.info(`Lead synced to CRM with ID: ${crmResult.id}`);
      }
    } catch (err) {
      strapi.log.error(`Failed to sync lead to CRM for ${lead.email}:`, err);
    }

    return response;
  },
}));
