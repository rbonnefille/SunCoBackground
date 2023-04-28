import { ticketViaTypes } from "./ticketViaTypes.js";

let CLIENT = null;
let APP_SETTINGS = null;

const ZDClient = {
  init() {
    CLIENT = ZAFClient.init();
    CLIENT.on("app.registered", (data) => {
      APP_SETTINGS = data.metadata.settings;
    });
  },

  /**
   * Calls ZAF Client.request()
   * @returns {Promise}
   */
  async request(url, data, options = {}) {
    return await CLIENT.request({
      url,
      data,
      contentType: "application/json",
      ...options,
    });
  },

  /**
   * Calls ZAF Client.get()
   * @param {String} getter
   * @param {Boolean} custom
   * @returns {Object}
   */
  async get(getter, custom = false) {
    if (custom) {
      return (await CLIENT.get(getter))[getter];
    }
    return await CLIENT.get(getter);
  },
};

/**
 * Initialize app
 */
ZDClient.init();

/**
 * Listen ticket status change
 */
CLIENT.on("ticket.status.changed", () => {
  init();
});

/**
 *
 * @returns {void}
 */
async function init() {
  const { ticket } = await ZDClient.get("ticket");
  if (!ticketViaTypes.includes(ticket.via.channel)) return;
  const customFieldSunCoConversationId = await ZDClient.get(
    `ticket.customField:custom_field_${APP_SETTINGS.sunco_conversation_id_ticket_field}`,
    true
  );
  if (customFieldSunCoConversationId) return;
  try {
    let conversationId;
    const { audits } = await getTicketAudits(ticket.id);
    const events = audits.map((audit) => audit.events).flat();
    const chatStartedEvent = events.find(
      (event) => event.type === "ChatStartedEvent"
    );
    if (chatStartedEvent) {
      const { conversation_id } = chatStartedEvent.value;
      conversationId = chatStartedEvent ? conversation_id : undefined;
    } else {
      console.log("No event with chatStartedEvent found");
    }
    if (!conversationId) return;
    updateTicket(ticket.id, conversationId);
  } catch (error) {
    console.error(error);
  }
}

/**
 *
 * @param {String} ticketId
 * @param {String} conversationId
 * @returns {Object}
 */
async function updateTicket(ticketId, conversationId) {
  try {
    const payload = {
      ticket: {
        custom_fields: [
          {
            id: APP_SETTINGS.sunco_conversation_id_ticket_field,
            value: conversationId,
          },
        ],
      },
    };
    return await ZDClient.request(
      `/api/v2/tickets/${ticketId}.json`,
      JSON.stringify(payload),
      {
        type: "PUT",
      }
    );
  } catch (error) {
    console.error("Error updateTicket: ", error);
    throw error;
  }
}

/**
 *
 * @param {String} ticketId
 * @returns {Object}
 */
async function getTicketAudits(ticketId) {
  try {
    const response = await ZDClient.request(
      `/api/v2/tickets/${ticketId}/audits.json`
    );
    return response;
  } catch (error) {
    console.error("Error getTicketAudits: ", error);
    throw error;
  }
}
