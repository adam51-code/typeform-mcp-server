// Typeform MCP Server - Zero dependencies
// Implements MCP (JSON-RPC 2.0) protocol directly

var SERVER_INFO = { name: "typeform-api", version: "1.0.0" };
var PROTOCOL_VERSION = "2024-11-05";

// -- Typeform API caller --

async function callTypeform(env, method, path, body) {
  var base = env.TYPEFORM_BASE_URL || "https://api.typeform.com";
  var headers = { Authorization: "Bearer " + env.TYPEFORM_API_TOKEN };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  var res = await fetch(base + path, {
    method: method,
    headers: headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  var text = await res.text();
  if (!res.ok) return { _error: true, status: res.status, body: text };
  try { return JSON.parse(text); } catch (e) { return text; }
}

function toolResult(data) {
  return {
    content: [{
      type: "text",
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    }],
  };
}

// -- Tool definitions --

var TOOLS = [
  {
    name: "typeform_api__get_me",
    description: "Retrieve basic Typeform account info (alias, email, language).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "typeform_api__list_workspaces",
    description: "List all workspaces in the Typeform account.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page number (1-based)." },
        page_size: { type: "string", description: "Results per page (max 200)." },
        search: { type: "string", description: "Filter workspaces by name." },
      },
    },
  },
  {
    name: "typeform_api__get_workspace",
    description: "Retrieve a specific workspace by ID.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "Workspace ID." },
      },
      required: ["workspace_id"],
    },
  },
  {
    name: "typeform_api__list_forms",
    description: "List all forms in the account. Optionally filter by workspace.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page number (1-based)." },
        page_size: { type: "string", description: "Results per page (max 200)." },
        search: { type: "string", description: "Filter forms by title." },
        workspace_id: { type: "string", description: "Filter by workspace ID." },
      },
    },
  },
  {
    name: "typeform_api__get_form",
    description: "Retrieve a specific form by its form_id, including all fields and settings.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID (from the form URL, e.g. u6nXL7)." },
      },
      required: ["form_id"],
    },
  },
  {
    name: "typeform_api__get_form_responses",
    description: "Retrieve responses/submissions for a form. Supports filtering by date, completion, and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID." },
        page_size: { type: "string", description: "Number of responses per page (max 1000, default 25)." },
        since: { type: "string", description: "ISO 8601 date. Only responses submitted after this date." },
        until: { type: "string", description: "ISO 8601 date. Only responses submitted before this date." },
        after: { type: "string", description: "Response token for pagination." },
        before: { type: "string", description: "Response token for pagination." },
        completed: { type: "string", description: "Filter: true for completed, false for partial." },
        sort: { type: "string", description: "Sort order, e.g. submitted_at,desc." },
        query: { type: "string", description: "Search responses containing this text." },
        fields: { type: "string", description: "Comma-separated field IDs to include." },
      },
      required: ["form_id"],
    },
  },
  {
    name: "typeform_api__create_form",
    description: "Create a new Typeform. Provide title and optionally fields as a JSON string.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Form title." },
        workspace_href: { type: "string", description: "Workspace API URL." },
        fields_json: { type: "string", description: "JSON string of fields array." },
        settings_json: { type: "string", description: "JSON string of settings object." },
        theme_href: { type: "string", description: "Theme API URL." },
      },
      required: ["title"],
    },
  },
  {
    name: "typeform_api__update_form",
    description: "Update an existing form (PATCH). Only send the fields you want to change.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID to update." },
        title: { type: "string", description: "New title." },
        fields_json: { type: "string", description: "JSON string of updated fields array." },
        settings_json: { type: "string", description: "JSON string of updated settings." },
        theme_href: { type: "string", description: "New theme API URL." },
      },
      required: ["form_id"],
    },
  },
  {
    name: "typeform_api__delete_form",
    description: "Delete a form by its form_id. This is permanent.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID to delete." },
      },
      required: ["form_id"],
    },
  },
  {
    name: "typeform_api__list_webhooks",
    description: "List all webhooks configured for a form.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID." },
      },
      required: ["form_id"],
    },
  },
  {
    name: "typeform_api__get_webhook",
    description: "Retrieve a specific webhook by form_id and tag.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID." },
        tag: { type: "string", description: "Webhook tag." },
      },
      required: ["form_id", "tag"],
    },
  },
  {
    name: "typeform_api__create_or_update_webhook",
    description: "Create or update a webhook for a form.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID." },
        tag: { type: "string", description: "Webhook tag (identifier)." },
        url: { type: "string", description: "URL to receive webhook payloads." },
        enabled: { type: "string", description: "Whether active: true or false." },
        secret: { type: "string", description: "Secret for payload signing." },
      },
      required: ["form_id", "tag", "url"],
    },
  },
  {
    name: "typeform_api__delete_webhook",
    description: "Delete a webhook from a form.",
    inputSchema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Form ID." },
        tag: { type: "string", description: "Webhook tag to delete." },
      },
      required: ["form_id", "tag"],
    },
  },
  {
    name: "typeform_api__list_themes",
    description: "List all themes in the account.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page number." },
        page_size: { type: "string", description: "Results per page." },
      },
    },
  },
];

// -- Tool handlers --

async function handleTool(env, name, args) {
  var a = args || {};
  switch (name) {
    case "typeform_api__get_me":
      return toolResult(await callTypeform(env, "GET", "/me"));
    case "typeform_api__list_workspaces": {
      var q = "";
      var parts = [];
      if (a.page) parts.push("page=" + a.page);
      if (a.page_size) parts.push("page_size=" + a.page_size);
      if (a.search) parts.push("search=" + encodeURIComponent(a.search));
      if (parts.length) q = "?" + parts.join("&");
      return toolResult(await callTypeform(env, "GET", "/workspaces" + q));
    }
    case "typeform_api__get_workspace":
      return toolResult(await callTypeform(env, "GET", "/workspaces/" + a.workspace_id));
    case "typeform_api__list_forms": {
      var q2 = "";
      var p2 = [];
      if (a.page) p2.push("page=" + a.page);
      if (a.page_size) p2.push("page_size=" + a.page_size);
      if (a.search) p2.push("search=" + encodeURIComponent(a.search));
      if (a.workspace_id) p2.push("workspace_id=" + a.workspace_id);
      if (p2.length) q2 = "?" + p2.join("&");
      return toolResult(await callTypeform(env, "GET", "/forms" + q2));
    }
    case "typeform_api__get_form":
      return toolResult(await callTypeform(env, "GET", "/forms/" + a.form_id));
    case "typeform_api__get_form_responses": {
      var q3 = "";
      var p3 = [];
      if (a.page_size) p3.push("page_size=" + a.page_size);
      if (a.since) p3.push("since=" + encodeURIComponent(a.since));
      if (a.until) p3.push("until=" + encodeURIComponent(a.until));
      if (a.after) p3.push("after=" + encodeURIComponent(a.after));
      if (a.before) p3.push("before=" + encodeURIComponent(a.before));
      if (a.completed) p3.push("completed=" + a.completed);
      if (a.sort) p3.push("sort=" + encodeURIComponent(a.sort));
      if (a.query) p3.push("query=" + encodeURIComponent(a.query));
      if (a.fields) p3.push("fields=" + encodeURIComponent(a.fields));
      if (p3.length) q3 = "?" + p3.join("&");
      return toolResult(await callTypeform(env, "GET", "/forms/" + a.form_id + "/responses" + q3));
    }
    case "typeform_api__create_form": {
      var body = { title: a.title };
      if (a.workspace_href) body.workspace = { href: a.workspace_href };
      if (a.fields_json) body.fields = JSON.parse(a.fields_json);
      if (a.settings_json) body.settings = JSON.parse(a.settings_json);
      if (a.theme_href) body.theme = { href: a.theme_href };
      return toolResult(await callTypeform(env, "POST", "/forms", body));
    }
    case "typeform_api__update_form": {
      var body2 = {};
      if (a.title) body2.title = a.title;
      if (a.fields_json) body2.fields = JSON.parse(a.fields_json);
      if (a.settings_json) body2.settings = JSON.parse(a.settings_json);
      if (a.theme_href) body2.theme = { href: a.theme_href };
      return toolResult(await callTypeform(env, "PATCH", "/forms/" + a.form_id, body2));
    }
    case "typeform_api__delete_form":
      return toolResult(await callTypeform(env, "DELETE", "/forms/" + a.form_id));
    case "typeform_api__list_webhooks":
      return toolResult(await callTypeform(env, "GET", "/forms/" + a.form_id + "/webhooks"));
    case "typeform_api__get_webhook":
      return toolResult(await callTypeform(env, "GET", "/forms/" + a.form_id + "/webhooks/" + a.tag));
    case "typeform_api__create_or_update_webhook":
      return toolResult(await callTypeform(env, "PUT", "/forms/" + a.form_id + "/webhooks/" + a.tag, {
        url: a.url,
        enabled: a.enabled === "false" ? false : true,
        secret: a.secret || undefined,
      }));
    case "typeform_api__delete_webhook":
      return toolResult(await callTypeform(env, "DELETE", "/forms/" + a.form_id + "/webhooks/" + a.tag));
    case "typeform_api__list_themes": {
      var q4 = "";
      var p4 = [];
      if (a.page) p4.push("page=" + a.page);
      if (a.page_size) p4.push("page_size=" + a.page_size);
      if (p4.length) q4 = "?" + p4.join("&");
      return toolResult(await callTypeform(env, "GET", "/themes" + q4));
    }
    default:
      throw new Error("Unknown tool: " + name);
  }
}

// -- MCP Protocol (JSON-RPC 2.0) --

function jsonrpc(id, result) {
  return { jsonrpc: "2.0", id: id, result: result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id, error: { code: code, message: message } };
}

async function handleRpc(env, req) {
  var method = req.method;
  var params = req.params;
  var id = req.id;

  switch (method) {
    case "initialize":
      return jsonrpc(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return jsonrpc(id, {});

    case "tools/list":
      return jsonrpc(id, { tools: TOOLS });

    case "tools/call": {
      var name = (params || {}).name;
      var args = (params || {}).arguments;
      try {
        var result = await handleTool(env, name, args);
        return jsonrpc(id, result);
      } catch (err) {
        return jsonrpc(id, {
          content: [{ type: "text", text: "Error: " + err.message }],
          isError: true,
        });
      }
    }

    default:
      return jsonrpcError(id, -32601, "Method not found: " + method);
  }
}

// -- Worker entry --

export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", tools: TOOLS.length });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
        },
      });
    }

    // Auth gate
    if (env.MCP_AUTH_TOKEN) {
      var auth = request.headers.get("Authorization");
      if (auth !== "Bearer " + env.MCP_AUTH_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    if (!url.pathname.startsWith("/mcp")) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "GET") {
      return new Response("Use POST for MCP requests", { status: 405 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    var body;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json(jsonrpcError(null, -32700, "Parse error"), { status: 400 });
    }

    var headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    if (Array.isArray(body)) {
      var results = [];
      for (var i = 0; i < body.length; i++) {
        var res = await handleRpc(env, body[i]);
        if (res !== null) results.push(res);
      }
      if (results.length === 0) return new Response(null, { status: 202, headers: headers });
      return Response.json(results, { headers: headers });
    }

    var result = await handleRpc(env, body);
    if (result === null) return new Response(null, { status: 202, headers: headers });
    return Response.json(result, { headers: headers });
  },
};
