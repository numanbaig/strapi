/** @type {import('@strapi/strapi').Core.RouterConfig} */
export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/leads/waitlist',
      handler: 'api::lead.lead.waitlist',
      config: { auth: false },
    },
  ],
};
