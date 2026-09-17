// ── Typeform MCP Server ──────────────────────────────────────────────
// Zero-dependency Cloudflare Worker wrapping the Typeform REST API
// as an MCP (JSON-RPC 2.0) server for ClickUp Brain.

// ── 1. Helper ────────────────────────────────────────────────────────

async function apiFetch(env, method, path, query, body) {
  const base = (env.TYPEFORM_BASE_URL || "https://api.typeform.com").replace(/\/+$/, "");
  const url = new URL(path, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${env.TYPEFORM_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const res = await fetch(url.toString(), opts);
  const text = await res.text();
  if (!res.ok) return { error: true, status: res.status, body: text };
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ── 2. TOOLS ─────────────────────────────────────────────────────────

const TOOLS = {
  typeform_api__get_me: {
    description: "Retrieve basic account info (alias, email, language).",
    params: {},
  },

  typeform_api__list_workspaces: {
    description: "List all workspaces in the Typeform account.",
    params: {
      page: { type: "number", description: "Page number (1-based).", required: false },
      page_size: { type: "number", description: "Results per page (max 200).", required: false },
      search: { type: "string", description: "Filter workspaces by name.", required: false },
    },
  },

  typeform_api__get_workspace: {
    description: "Retrieve a specific workspace by ID.",
    params: {
      workspace_id: { type: "string", description: "Workspace ID.", required: true },
    },
  },

  typeform_api__list_forms: {
    description: "List all forms in the account. Optionally filter by workspace.",
    params: {
      page: { type: "number", description: "Page number (1-based).", required: false },
      page_size: { type: "number", description: "Results per page (max 200).", required: false },
      search: { type: "string", description: "Filter forms by title.", required: false },
      workspace_id: { type: "string", description: "Filter by workspace ID.", required: false },
    },
  },

  typeform_api__get_form: {
    description: "Retrieve a specific form by its form_id, including all fields and settings.",
    params: {
      form_id: { type: "string", description: "Form ID (from the form URL, e.g. u6nXL7).", required: true },
    },
  },

  typeform_api__get_form_responses: {
    description: "Retrieve responses/submissions for a form. Supports filtering by date, completion status, and pagination.",
    params: {
      form_id: { type: "string", description: "Form ID.", required: true },
      page_size: { type: "number", description: "Number of responses per page (max 1000, default 25).", required: false },
      since: { type: "string", description: "ISO 8601 date. Only responses submitted after this date.", required: false },
      until: { type: "string", description: "ISO 8601 date. Only responses submitted before this date.", required: false },
      after: { type: "string", description: "Response token. Retrieve responses after this one (for pagination).", required: false },
      before: { type: "string", description: "Response token. Retrieve responses before this one (for pagination).", required: false },
      completed: { type: "boolean", description: "Filter by completion: true for completed, false for partial.", required: false },
      sort: { type: "string", description: "Sort order, e.g. 'submitted_at,desc'.", required: false },
      query: { type: "string", description: "Search responses containing this text.", required: false },
      fields: { type: "string", description: "Comma-separated field IDs to include in response.", required: false },
    },
  },

  typeform_api__create_form: {
    description: "Create a new Typeform. Pass the full form definition as JSON.",
    params: {
      title: { type: "string", description: "Form title.", required: true },
      workspace_href: { type: "string", description: "Workspace API URL to create the form in (e.g. https://api.typeform.com/workspaces/ABC123).", required: false },
      fields: { type: "array", description: "Array of field objects defining the form questions.", required: false },
      settings: { type: "object", description: "Form settings object.", required: false },
      theme_href: { type: "string", description: "Theme API URL to apply.", required: false },
    },
  },

  typeform_api__update_form: {
    description: "Update an existing form (PATCH). Only send the fields you want to change.",
    params: {
      form_id: { type: "string", description: "Form ID to update.", required: true },
      title: { type: "string", description: "New title.", required: false },
      fields: { type: "array", description: "Updated array of field objects.", required: false },
      settings: { type: "object", description: "Updated settings object.", required: false },
      theme_href: { type: "string", description: "New theme API URL.", required: false },
    },
  },

  typeform_api__delete_form: {
    description: "Delete a form by its form_id. This is permanent.",
    params: {
      form_id: { type: "string", description: "Form ID to delete.", required: true },
    },
  },

  typeform_api__list_webhooks: {
    description: "List all webhooks configured for a form.",
    params: {
      form_id: { type: "string", description: "Form ID.", required: true },
    },
  },

  typeform_api__get_webhook: {
    description: "Retrieve a specific webhook by form_id and tag.",
    params: {
      form_id: { type: "string", description: "Form ID.", required: true },
      tag: { type: "string", description: "Webhook tag.", required: true },
    },
  },

  typeform_api__create_or_update_webhook: {
    description: "Create or update a webhook for a form.",
    params: {
      form_id: { type: "string", description: "Form ID.", required: true },
      tag: { type: "string", description: "Webhook tag (identifier).", required: true },
      url: { type: "string", description: "URL to receive webhook payloads.", required: true },
      enabled: { type: "boolean", description: "Whether the webhook is active.", required: false },
      secret: { type: "string", description: "Secret for payload signing.", required: false },
    },
  },

  typeform_api__delete_webhook: {
    description: "Delete a webhook from a form.",
    params: {
      form_id: { type: "string", description: "Form ID.", required: true },
      tag: { type: "string", description: "Webhook tag to delete.", required: true },
    },
  },

  typeform_api__list_themes: {
    description: "List all themes in the account.",
    params: {
      page: { type: "number", description: "Page number.", required: false },
      page_size: { type: "number", description: "Results per page.", required: false },
    },
  },

  typeform_api__list_images: {
    description: "List all images in the account.",
    params: {},
  },
};

// ── 3. executeTool ───────────────────────────────────────────────────

async function executeTool(env, name, args) {
  switch (name) {
    case "typeform_api__get_me":
      return apiFetch(env, "GET", "/me");

    case "typeform_api__list_workspaces":
      return apiFetch(env, "GET", "/workspaces", {
        page: args.page, page_size: args.page_size, search: args.search,
      });

    case "typeform_api__get_workspace":
      return apiFetch(env, "GET", `/workspaces/${args.workspace_id}`);

    case "typeform_api__list_forms":
      return apiFetch(env, "GET", "/forms", {
        page: args.page, page_size: args.page_size, search: args.search,
        workspace_id: args.workspace_id,
      });

    case "typeform_api__get_form":
      return apiFetch(env, "GET", `/forms/${args.form_id}`);

    case "typeform_api__get_form_responses":
      return apiFetch(env, "GET", `/forms/${args.form_id}/responses`, {
        page_size: args.page_size, since: args.since, until: args.until,
        after: args.after, before: args.before,
        completed: args.completed !== undefined ? String(args.completed) : undefined,
        sort: args.sort, query: args.query, fields: args.fields,
      });

    case "typeform_api__create_form": {
      const body = { title: args.title };
      if (args.workspace_href) body.workspace = { href: args.workspace_href };
      if (args.fields) body.fields = args.fields;
      if (args.settings) body.settings = args.settings;
      if (args.theme_href) body.theme = { href: args.theme_href };
      return apiFetch(env, "POST", "/forms", null, body);
    }

    case "typeform_api__update_form": {
      const body = {};
      if (args.title) body.title = args.title;
      if (args.fields) body.fields = args.fields;
      if (args.settings) body.settings = args.settings;
      if (args.theme_href) body.theme = { href: args.theme_href };
      return apiFetch(env, "PATCH", `/forms/${args.form_id}`, null, body);
    }

    case "typeform_api__delete_form":
      return apiFetch(env, "DELETE", `/forms/${args.form_id}`);

    case "typeform_api__list_webhooks":
      return apiFetch(env, "GET", `/forms/${args.form_id}/webhooks`);

    case "typeform_api__get_webhook":
      return apiFetch(env, "GET", `/forms/${args.form_id}/webhooks/${args.tag}`);

    case "typeform_api__create_or_update_webhook":
      return apiFetch(env, "PUT", `/forms/${args.form_id}/webhooks/${args.tag}`, null, {
        url: args.url,
        enabled: args.enabled !== undefined ? args.enabled : true,
        ...(args.secret && { secret: args.secret }),
      });

    case "typeform_api__delete_webhook":
      return apiFetch(env, "DELETE", `/forms/${args.form_id}/webhooks/${args.tag}`);

    case "typeform_api__list_themes":
      return apiFetch(env, "GET", "/themes", {
        page: args.page, page_size: args.page_size,
      });

    case "typeform_api__list_images":
      return apiFetch(env, "GET", "/images");

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── 4. JSON-RPC router ───────────────────────────────────────────────

function buildSchema(toolName, toolDef) {
  const properties = {};
  const required = [];
  for (const [k, v] of Object.entries(toolDef.params)) {
    properties[k] = { type: v.type || "string", description: v.description };
    if (v.required) required.push(k);
  }
  return {
    name: toolName,
    description: toolDef.description,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length && { required }),
    },
  };
}

async function handleRpc(request, env) {
  const { method, params, id } = await request.json();

  if (method === "initialize") {
    return new Response(JSON.stringify({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "typeform-mcp-server", version: "1.0.0" },
      },
    }), { headers: { "Content-Type": "application/json" } });
  }

  if (method === "notifications/initialized") {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "tools/list") {
    const tools = Object.entries(TOOLS).map(([n, d]) => buildSchema(n, d));
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: { tools } }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    if (!TOOLS[toolName]) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0", id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      }), { headers: { "Content-Type": "application/json" } });
    }
    const result = await executeTool(env, toolName, toolArgs);
    return new Response(JSON.stringify({
      jsonrpc: "2.0", id,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    jsonrpc: "2.0", id,
    error: { code: -32601, message: `Method not found: ${method}` },
  }), { headers: { "Content-Type": "application/json" } });
}

// ── 5. Worker entry ──────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({
        status: "ok",
        tools: Object.keys(TOOLS).length,
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Auth check: extract Bearer token using split to avoid regex escaping issues
    const auth = request.headers.get("Authorization") || "";
    const parts = auth.split(" ");
    const token = parts.length > 1 ? parts.slice(1).join(" ") : "";
    if (token !== env.MCP_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/mcp" && request.method === "POST") {
      return handleRpc(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
