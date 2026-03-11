/** @type {import('@strapi/strapi').Core.RouterConfig} */
export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/webhooks/booking',
      handler: 'webhook.handleBooking',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/webhooks/crm',
      handler: 'webhook.handleCrm',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
