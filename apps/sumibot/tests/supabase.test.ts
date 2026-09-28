import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";
import { SupabaseAttendanceStore } from "../src/infrastructure/supabase/supabase-attendance-store";
import { SupabaseEventLog } from "../src/infrastructure/supabase/supabase-event-log";
import { SupabasePhotoStorage } from "../src/infrastructure/supabase/supabase-photo-storage";
import { GROUP_CHAT, LIBRARIAN_PHONE, makeMessage } from "./fixtures";

const URL_BASE = "https://abc.supabase.co";

interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Record<string, string>;
  readonly body: unknown;
}

interface FakeReply {
  readonly status?: number;
  readonly json: unknown;
}

// The real supabase-js client over a fetch that answers from memory, so the
// queries the adapters build are the ones a Supabase project would receive.
function setup(respond: (request: RecordedRequest) => FakeReply) {
  const requests: RecordedRequest[] = [];
  const fakeFetch = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const text = typeof init?.body === "string" ? init.body : undefined;
    // A repeated parameter, like a range's two bounds on one column, joins
    // with "&".
    const query: Record<string, string> = {};
    for (const [name, value] of url.searchParams) {
      query[name] = name in query ? `${query[name]}&${value}` : value;
    }
    const request: RecordedRequest = {
      method: init?.method ?? "GET",
      path: url.pathname,
      query,
      body: text === undefined ? undefined : tryParse(text),
    };
    requests.push(request);
    const { status = 200, json } = respond(request);
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createClient(URL_BASE, "k".repeat(32), {
    auth: { persistSession: false },
    global: { fetch: fakeFetch as typeof fetch },
  });
  return { client, requests };
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const KEY = `${LIBRARIAN_PHONE}@s.whatsapp.net`;

describe("SupabaseAttendanceStore", () => {
  test("records an attendance row keyed by the manager's jid", async () => {
    const { client, requests } = setup(() => ({ status: 201, json: null }));

    await new SupabaseAttendanceStore(client).record({
      action: "open",
      managerNumber: LIBRARIAN_PHONE,
      imageUrl: "https://files.example/a.jpg",
      timestamp: new Date("2025-03-10T14:05:00Z"),
    });

    expect(requests).toMatchObject([
      {
        method: "POST",
        path: "/rest/v1/libraryAttendance",
        body: [
          {
            timestamp: "2025-03-10T14:05:00.000Z",
            action: "open",
            managerNumber: KEY,
            imageUrl: "https://files.example/a.jpg",
          },
        ],
      },
    ]);
  });

  test("fails with the table and the reason when the insert is rejected", async () => {
    const { client } = setup(() => ({
      status: 400,
      json: { message: "column does not exist" },
    }));

    await expect(
      new SupabaseAttendanceStore(client).record({
        action: "close",
        managerNumber: LIBRARIAN_PHONE,
        imageUrl: "x",
        timestamp: new Date(),
      })
    ).rejects.toThrow("insert into libraryAttendance: column does not exist");
  });

  test("reads the newest row of an action and returns the phone number", async () => {
    const { client, requests } = setup(() => ({
      json: [{ timestamp: "2025-03-10T14:05:00+00:00", managerNumber: KEY }],
    }));

    const latest = await new SupabaseAttendanceStore(client).latest("close");

    expect(latest).toEqual({
      managerNumber: LIBRARIAN_PHONE,
      timestamp: new Date("2025-03-10T14:05:00Z"),
    });
    expect(requests[0]).toMatchObject({
      method: "GET",
      path: "/rest/v1/libraryAttendance",
      query: {
        select: "timestamp,managerNumber",
        action: "eq.close",
        order: "timestamp.desc",
        limit: "1",
      },
    });
  });

  test("reads null when the action has never happened", async () => {
    const { client } = setup(() => ({ json: [] }));

    expect(await new SupabaseAttendanceStore(client).latest("open")).toBeNull();
  });

  test("reads the openings inside a time range, oldest first", async () => {
    const { client, requests } = setup(() => ({
      json: [
        {
          imageUrl: "https://files.example/a.jpg",
          timestamp: "2025-03-10T14:05:00+00:00",
          managerNumber: KEY,
        },
      ],
    }));

    const openings = await new SupabaseAttendanceStore(client).openingsBetween(
      new Date("2025-03-10T05:00:00Z"),
      new Date("2025-03-11T04:59:59.999Z")
    );

    expect(openings).toEqual([
      {
        managerNumber: LIBRARIAN_PHONE,
        imageUrl: "https://files.example/a.jpg",
        timestamp: new Date("2025-03-10T14:05:00Z"),
      },
    ]);
    expect(requests[0]?.query).toMatchObject({
      action: "eq.open",
      timestamp: "gte.2025-03-10T05:00:00.000Z&lte.2025-03-11T04:59:59.999Z",
      order: "timestamp.asc",
    });
  });

  test("looks a librarian up by jid and returns the full name", async () => {
    const { client, requests } = setup(() => ({
      json: [{ fullName: "Ana Pérez" }],
    }));

    const name = await new SupabaseAttendanceStore(client).librarianName(
      LIBRARIAN_PHONE
    );

    expect(name).toBe("Ana Pérez");
    expect(requests[0]).toMatchObject({
      path: "/rest/v1/librarians",
      query: { select: "fullName", managerNumber: `eq.${KEY}` },
    });
  });

  test("returns null for a number that is not a librarian", async () => {
    const { client } = setup(() => ({ json: [] }));

    expect(
      await new SupabaseAttendanceStore(client).librarianName("51900000001")
    ).toBeNull();
  });
});

describe("SupabasePhotoStorage", () => {
  test("uploads the photo under the sender's folder and returns its public URL", async () => {
    const { client, requests } = setup(() => ({ json: { Key: "ok" } }));

    const url = await new SupabasePhotoStorage(client).upload(
      LIBRARIAN_PHONE,
      Buffer.from("jpeg-bytes")
    );

    const upload = requests[0]!;
    expect(upload.method).toBe("POST");
    expect(upload.path).toMatch(
      new RegExp(
        `^/storage/v1/object/collaborators/${LIBRARIAN_PHONE}/[0-9a-f-]{36}\\.jpg$`
      )
    );
    expect(url).toBe(
      `${URL_BASE}${upload.path.replace("/object/", "/object/public/")}`
    );
  });

  test("fails with the reason when the upload is rejected", async () => {
    const { client } = setup(() => ({
      status: 400,
      json: { message: "bucket not found", error: "not_found" },
    }));

    await expect(
      new SupabasePhotoStorage(client).upload(LIBRARIAN_PHONE, Buffer.from("x"))
    ).rejects.toThrow("upload to collaborators: bucket not found");
  });
});

describe("SupabaseEventLog", () => {
  test("logs a command use", async () => {
    const { client, requests } = setup(() => ({ status: 201, json: null }));

    await new SupabaseEventLog(client).commandUsed({
      commandId: "!estado",
      commandName: "estado",
      message: makeMessage({ body: "!estado" }),
      at: new Date("2025-03-10T14:05:00Z"),
    });

    expect(requests).toMatchObject([
      {
        method: "POST",
        path: "/rest/v1/CommandsUsage",
        body: [
          {
            command_id: "!estado",
            user_phone_number: KEY,
            command_name: "estado",
            execution_timestamp: "2025-03-10T14:05:00.000Z",
          },
        ],
      },
    ]);
  });

  test("logs an error with the message that caused it", async () => {
    const { client, requests } = setup(() => ({ status: 201, json: null }));
    const message = makeMessage({ body: "!nada" });

    await new SupabaseEventLog(client).failed({
      message,
      error: new Error("Unrecognized command: nada"),
      at: new Date("2025-03-10T14:05:00Z"),
    });

    const [row] = requests[0]!.body as Record<string, string>[];
    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/rest/v1/ErrorLogs",
    });
    expect(row).toMatchObject({
      user_phone_number: KEY,
      error_timestamp: "2025-03-10T14:05:00.000Z",
      additional_info: "Unrecognized command: nada",
    });
    expect(JSON.parse(row!["error_message"]!)).toMatchObject({
      chatId: GROUP_CHAT,
      body: "!nada",
    });
  });

  test("fails when the insert is rejected", async () => {
    const { client } = setup(() => ({
      status: 401,
      json: { message: "invalid key" },
    }));

    await expect(
      new SupabaseEventLog(client).commandUsed({
        commandId: "!estado",
        commandName: "estado",
        message: makeMessage(),
        at: new Date(),
      })
    ).rejects.toThrow("insert into CommandsUsage: invalid key");
  });
});
