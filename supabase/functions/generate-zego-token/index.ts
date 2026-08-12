import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { generateToken04 } from "./token04.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabasePublishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("Supabase server environment is incomplete");
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized user" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const body = await req.json();
    const roomId = String(body.roomId ?? body.room_id ?? "").trim();

    if (!roomId) {
      return new Response(
        JSON.stringify({ error: "roomId is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const appIdRaw = Deno.env.get("ZEGO_APP_ID") || Deno.env.get("ZEGOCLOUD_APP_ID");
    const appId = (appIdRaw && Number.isInteger(Number(appIdRaw))) ? Number(appIdRaw) : 366567418;
    const serverSecret = Deno.env.get("ZEGO_SERVER_SECRET") || Deno.env.get("ZEGOCLOUD_SERVER_SECRET");

    if (!serverSecret) {
      throw new Error("ZEGO_SERVER_SECRET environment variable is missing");
    }

    const expiresIn = 3600;

    const token = generateToken04(
      appId,
      user.id,
      serverSecret,
      expiresIn,
      "",
    );

    return new Response(
      JSON.stringify({
        token,
        appId,
        userId: user.id,
        roomId,
        expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("GENERATE_ZEGO_TOKEN_ERROR:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Internal Server Error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});