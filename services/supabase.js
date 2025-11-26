const path = require(`path`);
require(`dotenv`).config({ path: path.resolve(__dirname, `../.env`) });
const { createClient } = require(`@supabase/supabase-js`);

const SUPABASE_BASE_URL = process.env.SUPABASE_BASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;

const supabase = createClient(SUPABASE_BASE_URL, SUPABASE_API_KEY, {
  auth: {
    persistSession: false,
  },
});

async function fetchLastNMessages(phoneNumber, group, n) {
  try {
    const { data, error } = await supabase
      .from("gpt_messages")
      .select("message, sender, created_at")
      .eq("user", phoneNumber)
      .eq("group", group)
      .order("created_at", { ascending: false })
      .limit(n);

    if (error) throw error;

    return data.reverse();
  } catch (error) {
    console.error("Could not fetch messages", error);
    return [];
  }
}

async function addMessage(
  phoneNumber,
  group,
  sender,
  message,
  conversation_id
) {
  try {
    const { error } = await supabase.from("gpt_messages").insert({
      user: phoneNumber,
      group,
      sender,
      message,
      conversation_id,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error adding message to database:", error);
  }
}

module.exports = {
  fetchLastNMessages,
  addMessage,
};
