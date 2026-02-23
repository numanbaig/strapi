import axios from 'axios';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const MAILGUN_FROM = process.env.MAILGUN_FROM || `noreply@${MAILGUN_DOMAIN}`;
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3';

async function sendEmail(params: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;

  const formData = new URLSearchParams();
  formData.append('from', MAILGUN_FROM);
  formData.append('to', params.to);
  formData.append('subject', params.subject);
  if (params.text) formData.append('text', params.text);
  if (params.html) formData.append('html', params.html);

  const response = await axios.post(url, formData.toString(), {
    auth: { username: 'api', password: MAILGUN_API_KEY },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data;
}

export async function sendLeadAcknowledgmentEmail(params: {
  to: string;
  name: string;
}) {
  return sendEmail({
    to: params.to,
    subject: 'Thank you for reaching out!',
    html: `
      <h2>Hi ${params.name},</h2>
      <p>Thank you for your interest. We have received your inquiry and will get back to you shortly.</p>
      <p>Best regards,<br/>The Team</p>
    `,
  });
}

export async function sendBookingConfirmationEmail(params: {
  to: string;
  name: string;
  date: string;
  time: string;
  meetingLink?: string;
}) {
  const meetingSection = params.meetingLink
    ? `<p><strong>Meeting Link:</strong> <a href="${params.meetingLink}">${params.meetingLink}</a></p>`
    : '';

  return sendEmail({
    to: params.to,
    subject: 'Your meeting has been confirmed',
    html: `
      <h2>Hi ${params.name},</h2>
      <p>Your meeting has been successfully scheduled.</p>
      <p><strong>Date:</strong> ${params.date}</p>
      <p><strong>Time:</strong> ${params.time}</p>
      ${meetingSection}
      <p>We look forward to speaking with you!</p>
      <p>Best regards,<br/>The Team</p>
    `,
  });
}

export async function sendFollowUpEmail(params: {
  to: string;
  name: string;
  stage: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Update on your inquiry`,
    html: `
      <h2>Hi ${params.name},</h2>
      <p>We wanted to give you an update. Your inquiry status has been updated to: <strong>${params.stage}</strong>.</p>
      <p>If you have any questions, feel free to reach out.</p>
      <p>Best regards,<br/>The Team</p>
    `,
  });
}
