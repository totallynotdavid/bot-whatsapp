const supabase = require(`./supabaseClient.js`);

async function insertMessage(phoneNumber, message, group) {
  try {
    /* eslint-disable no-unused-vars*/
    const { data, error } = await supabase
      .from(`users`)
      .insert({ user: phoneNumber, message: message, group: group });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.log(`Could not insert message`, error);
  }
}

async function addGPTConversations(
  phoneNumber,
  message,
  group,
  tableName,
  sender = `user`
) {
  try {
    if (message === null) {
      console.log(
        `El mensaje es null. Logs: [sender: ${sender}, phoneNumber: ${phoneNumber}, group: ${group}]`
      );
      return;
    }

    const { data, error } = await supabase.from(tableName).insert({
      user: phoneNumber,
      message: message,
      group: group,
      conversation_id: `${group}_${phoneNumber}`,
      sender: sender, // 'user' or 'bot'
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.log(`Could not insert message`, error);
  }
}

async function insertToTable(tableName, insertData) {
  const { data, error, status } = await supabase
    .from(tableName)
    .insert(insertData);

  if (error) {
    throw error;
  }

  return status === 201;
}

// This section is for the premium groups table

async function searchTable(tableName, column, value) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq(column, value);

  if (error) {
    throw error;
  }

  return data;
}

async function searchPremiumGroup(group_id) {
  const data = await searchTable("premium_groups", "group_id", group_id);
  return data.length > 0 ? data[0] : null;
}

async function addPremiumGroup(group_id, group_name, phoneNumber) {
  if (!group_id || !group_name || !phoneNumber) {
    throw new Error(`Invalid input data`);
  }

  const premiumGroup = await searchPremiumGroup(group_id);

  // Here we check if the group already exists and the previous owner's premium status has expired
  if (
    premiumGroup &&
    premiumGroup.contact_number !== phoneNumber &&
    premiumGroup.isActive === false
  ) {
    await updatePremiumGroup(group_id, group_name, phoneNumber);
  } else if (!premiumGroup) {
    const insertData = {
      group_id,
      group_name,
      contact_number: phoneNumber,
      isActive: true,
    };

    return insertToTable(`premium_groups`, insertData);
  } else {
    throw new Error(`Este grupo ya está registrado`);
  }
}

async function updatePremiumGroup(group_id, group_name, phoneNumber) {
  const { data, error } = await supabase
    .from(`premium_groups`)
    .update({
      contact_number: phoneNumber,
      group_name: group_name,
      isActive: true,
    })
    .eq(`group_id`, group_id);

  if (error) {
    throw error;
  }

  return data;
}

// This section is for the paid users table

async function getPremiumUser(phoneNumber) {
  const { data, error } = await supabase
    .from(`paid_users`)
    .select(`*`)
    .eq(`phone_number`, phoneNumber);

  if (error) {
    throw error;
  }

  return data[0];
}

async function addPremiumUser(phoneNumber, customerName, days) {
  // Fetch existing user and get the expiry date
  const user = await getPremiumUser(phoneNumber);
  const date = user ? new Date(user.premium_expiry) : new Date();

  // Add the new days to the date
  date.setDate(date.getDate() + days);
  const premiumExpiry = date.toISOString();

  const upsertData = {
    phone_number: phoneNumber,
    customer_name: customerName,
    premium_expiry: premiumExpiry,
  };

  const { data, error, status } = await supabase
    .from(`paid_users`)
    .upsert(upsertData, { onConflict: `phone_number` });

  if (error) {
    throw error;
  }

  return status === 200 || status === 201;
}

// This section is for fetching all the data from the database tables

async function updateTable(
  table,
  values,
  column,
  arrayOfValues,
  whereCondition
) {
  let query = supabase.from(table).update(values);

  if (column && arrayOfValues) {
    query = query.in(column, arrayOfValues);
  } else if (whereCondition) {
    query = query.eq(whereCondition.column, whereCondition.value);
  } else {
    throw new Error(
      `Update operation requires either a column with an array of values or a where condition.`
    );
  }

  const response = await query;

  if (response.error) {
    throw response.error;
  }

  return response;
}

async function fetchDataFromTable(table, ...columns) {
  const { data, error } = await supabase.from(table).select(columns.join(`,`));

  if (error) {
    throw error;
  }

  return data;
}

async function fetchLastNMessages(phoneNumber, group, n) {
  try {
    const { data, error } = await supabase
      .from(`gpt_messages`)
      .select(`message, sender, created_at`)
      .eq(`user`, phoneNumber)
      .eq(`group`, group)
      .order(`created_at`, { ascending: false })
      .limit(n);

    if (error) {
      throw error;
    }

    data.reverse(); // Reverse the order of the messages so that they are in chronological order

    const messages = data.map((m) => {
      return { role: m.sender, content: m.message };
    });

    // Make sure to respect the order of messages before and after the summary
    // If there is a summary, it will be the last element in the array
    let foundSummary = false;
    const splitMessages = [];
    for (const message of messages) {
      if (
        message.role === `system` &&
        message.content.startsWith(`Summary: `)
      ) {
        foundSummary = true;
        splitMessages.push([]);
      }

      if (foundSummary) {
        splitMessages[splitMessages.length - 1].push(message);
      } else {
        if (splitMessages.length === 0) splitMessages.push([]);
        splitMessages[0].push(message);
      }
    }

    return splitMessages;
  } catch (error) {
    console.log(`Could not fetch messages`, error);
    return [];
  }
}

// Bot status (enabled/disabled) functions
async function updateBotStatus(groupId, isActive) {
  const { data, error } = await supabase
    .from(`premium_groups`)
    .update({ isActive })
    .eq(`group_id`, groupId);

  if (error) {
    throw error;
  }

  return data;
}

async function searchSpecialDay(groupId) {
  const { data, error } = await supabase
    .from(`premium_groups`)
    .select(`special_day_expiry`)
    .eq(`group_id`, groupId);

  if (error) {
    throw error;
  }

  return data[0];
}

module.exports = {
  insertMessage,
  searchTable,
  updateTable,
  addPremiumUser,
  addPremiumGroup,
  searchPremiumGroup,
  fetchDataFromTable,
  addGPTConversations,
  fetchLastNMessages,
  updateBotStatus,
  searchSpecialDay,
};
