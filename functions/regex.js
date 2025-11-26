// Used when converting external media to stickers. GIFs are not supported because they are not animated stickers
const urlRegex =
  /^(?:https?:\/\/)?[\w.-]+(?:\.[\w]+\b)+\/[\w\-._~:/?#[\]@!$&'()*+,;=.%]*(\.(jpg|jpeg|gifv|png|mp4))$/;
const imageOrVideoRegex = /\.(jpg|jpeg|gifv|png|mp4)$/i;
const websiteAllowedRegex =
  /^https?:\/\/(?:www\.)?reddit\.com\/r\/[\w-]+\/comments\/[\w-]+\/[\w-]+\/?$/i;

module.exports = {
  urlRegex,
  imageOrVideoRegex,
  websiteAllowedRegex,
};
