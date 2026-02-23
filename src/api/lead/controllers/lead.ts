import { factories } from '@strapi/strapi';
import { sendLeadAcknowledgmentEmail } from '../../../services/mailgun';
import { createLeadInCrm } from '../../../services/twenty-crm';

export default factories.createCoreController('api::lead.lead', ({ strapi }) => ({
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
