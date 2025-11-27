/**
 * Google Drive Service
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(process.cwd(), 'data', 'driveToken.json');
const CREDENTIALS_PATH = path.join(
  process.cwd(),
  'data',
  'driveCredentials.json'
);

const folderId = process.env.DRIVE_FOLDER_ID;

/**
 * Load saved credentials if they exist
 * @returns {Promise<Object|null>} Auth client or null
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fsPromises.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    const client = google.auth.fromJSON(credentials);
    client.setCredentials(credentials);
    return client;
  } catch (err) {
    return null;
  }
}

/**
 * Save credentials
 * @param {Object} client - Auth client
 */
async function saveCredentials(client) {
  const content = await fsPromises.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
    access_token: client.credentials.access_token,
    expiry_date: client.credentials.expiry_date,
  });
  await fsPromises.writeFile(TOKEN_PATH, payload);
}

/**
 * Authorize with Google Drive
 * @returns {Promise<Object>} Auth client
 */
async function authorize() {
  const client = await loadSavedCredentialsIfExist();
  if (client) {
    if (!client.credentials.refresh_token) {
      console.log('Refresh token is invalid, generating authorization URL...');
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log('Authorize this app by visiting this URL: ${authUrl}');
      throw new Error('Please authorize the application and restart it.');
    }

    return client;
  }

  const authClient = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (authClient.credentials) {
    console.log('authClient.credentials found, saving credentials...');
    await saveCredentials(authClient);
    return authClient;
  } else {
    console.log(
      'authClient.credentials not found, generating authorization URL...'
    );
    const authUrl = authClient.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Authorize this app by visiting this URL: ${authUrl}');
    throw new Error('Please authorize the application and restart it.');
  }
}

/**
 * Search folder database
 * @param {string} query - Search query
 * @returns {Promise<Array>} Search results
 */
async function searchFolderDatabase(query) {
  const dbFilePath = path.join(
    process.cwd(),
    'data',
    'folderDatabase.sqlite'
  );

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const escapedQuery = query.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
      const queryString = `%${escapedQuery}%`;
      const results = [];

      db.each(
        'SELECT * FROM files WHERE name LIKE ?',
        [queryString],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          row.parents = row.parents ? JSON.parse(row.parents) : null;
          results.push(row);
        },
        (err) => {
          db.close();
          if (err) {
            reject(err);
            return;
          }
          resolve(results);
        }
      );
    });
  });
}

/**
 * Download file from Google Drive
 * @param {string} query - Drive link or file ID
 * @returns {Promise<string>} File path
 */
async function downloadFilesFromGoogleDrive(query) {
  const realFileId = extractFileIdFromDriveLink(query);

  try {
    const authClient = await authorize();
    const service = google.drive({ version: 'v3', auth: authClient });

    const fileMetadata = await service.files.get({
      fileId: realFileId,
      fields: 'webContentLink',
    });

    const response = await fetch(fileMetadata.data.webContentLink, {
      headers: {
        Authorization: `Bearer ${authClient.credentials.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error downloading file: ${response.statusText}`);
    }

    const pdfDir = path.join(process.cwd(), 'pdf');
    await fsPromises.mkdir(pdfDir, { recursive: true });
    const filePath = path.join(pdfDir, `${realFileId}.pdf`);
    console.log('The file will be saved in:', filePath);

    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    return filePath;
  } catch (err) {
    console.error('Error downloading file:', err);
    throw err;
  }
}

/**
 * Extract file ID from Drive link
 * @param {string} link - Drive link
 * @returns {string|null} File ID
 */
function extractFileIdFromDriveLink(link) {
  const fileIdRegex = /[-\w]{25,}/;
  const match = fileIdRegex.exec(link);
  return match ? match[0] : null;
}

export { searchFolderDatabase, downloadFilesFromGoogleDrive };