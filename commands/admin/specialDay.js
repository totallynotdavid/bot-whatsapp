const supabase = require("../../lib/api/supabaseCommunicationModule.js");

async function activateSpecialDay(senderPhoneNumber, groupId) {
  try {
    const group = await getGroupSpecialDay(groupId);
    const userGroups = await getUserGroupsWithActivatedDay(senderPhoneNumber);

    if (isGroupSpecialDayActive(group)) {
      return getSpecialDayAlreadyActiveMessage(group);
    }

    if (hasRecentActivation(userGroups)) {
      return getRecentActivationMessage(userGroups);
    }

    const specialDayExpiry = calculateSpecialDayExpiry();
    await updateGroupSpecialDayExpiry(groupId, specialDayExpiry);

    return "Día especial activado en este grupo. Los usuarios podrán usar el comando chat durante las próximas 24 horas.";
  } catch (error) {
    console.error("Error in activateSpecialDay:", error.message);
    return "Hubo un error al activar el día especial en este grupo. Por favor, inténtelo de nuevo más tarde.";
  }
}

async function getGroupSpecialDay(groupId) {
  const group = await supabase.searchSpecialDay(groupId);
  return group;
}

async function getUserGroupsWithActivatedDay(contactNumber) {
  let groups = await supabase.searchTable(
    "premium_groups",
    "contact_number",
    contactNumber
  );
  return Array.isArray(groups) ? groups : [];
}

function isGroupSpecialDayActive(group) {
  return (
    group &&
    group.special_day_expiry &&
    new Date(group.special_day_expiry) > new Date()
  );
}

function getSpecialDayAlreadyActiveMessage(group) {
  const daysRemaining = Math.ceil(
    (new Date(group.special_day_expiry).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return `El día especial ya está activado en este grupo y expirará en ${daysRemaining} días. No se puede renovar hasta que expire.`;
}

function hasRecentActivation(groups) {
  const now = new Date();
  const recentActivations = groups.filter((group) => {
    if (!group.special_day_expiry) return false;
    const expiryDate = new Date(group.special_day_expiry);
    const thirtyDaysFromExpiry = new Date(expiryDate);
    thirtyDaysFromExpiry.setDate(thirtyDaysFromExpiry.getDate() + 30);
    return now < thirtyDaysFromExpiry;
  });

  return recentActivations.length > 0;
}

function getRecentActivationMessage(groups) {
  const recentActivation = groups.find((group) => group.special_day_expiry);
  const expiryDate = new Date(recentActivation.special_day_expiry);
  const thirtyDaysFromExpiry = new Date(expiryDate);
  thirtyDaysFromExpiry.setDate(thirtyDaysFromExpiry.getDate() + 30);

  return `Oe, ya activaste el día especial en el grupo ${recentActivation.group_name}.`;
}

function calculateSpecialDayExpiry() {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 1);
  return expiryDate;
}

async function updateGroupSpecialDayExpiry(groupId, expiryDate) {
  const updatedGroup = await supabase.updateTable(
    "premium_groups",
    { special_day_expiry: expiryDate },
    "group_id",
    [groupId]
  );
  if (!updatedGroup) {
    return "Hubo un error al activar el día especial en este grupo. Por favor, inténtelo de nuevo más tarde.";
  }
}

module.exports = {
  activateSpecialDay,
};
