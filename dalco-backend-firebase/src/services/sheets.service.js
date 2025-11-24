const { google } = require('googleapis');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');

class SheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.initializeAuth();
  }

  /**
   * Initialize Google Sheets API with service account
   */
  async initializeAuth() {
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        this.auth = new google.auth.JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        logger.info('Google Sheets API initialized with service account');
      } else {
        logger.warn('Google Sheets credentials not configured');
      }
    } catch (error) {
      logger.error(`Google Sheets initialization error: ${error.message}`);
    }
  }

  /**
   * Connect organization to a Google Sheet
   */
  async connectSheet(organizationId, spreadsheetId, sheetName = 'DalCo Data') {
    try {
      if (!this.sheets) {
        throw new Error('Google Sheets not initialized');
      }

      // Verify sheet exists
      const metadata = await this.sheets.spreadsheets.get({
        spreadsheetId
      });

      // Save connection to Firestore
      await db.collection('organizations').doc(organizationId).update({
        googleSheets: {
          spreadsheetId,
          sheetName,
          connected: true,
          connectedAt: new Date()
        }
      });

      // Initialize headers if sheet is new
      await this.initializeSheetHeaders(spreadsheetId, sheetName);

      return {
        success: true,
        spreadsheetId,
        sheetName,
        title: metadata.data.properties.title
      };
    } catch (error) {
      logger.error(`Sheet connection error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize sheet with headers
   */
  async initializeSheetHeaders(spreadsheetId, sheetName) {
    try {
      const headers = [
        'Timestamp',
        'From',
        'Channel',
        'Message',
        'Intent',
        'Customer Name',
        'Phone',
        'Email',
        'Service Type',
        'Preferred Date',
        'Preferred Time',
        'AI Response',
        'Status'
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:M1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      logger.info('Sheet headers initialized');
      return { success: true };
    } catch (error) {
      // If sheet doesn't exist, create it
      if (error.message.includes('Unable to parse range')) {
        await this.createSheet(spreadsheetId, sheetName);
        return await this.initializeSheetHeaders(spreadsheetId, sheetName);
      }
      throw error;
    }
  }

  /**
   * Create new sheet in spreadsheet
   */
  async createSheet(spreadsheetId, sheetName) {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });

      logger.info(`Sheet ${sheetName} created`);
      return { success: true };
    } catch (error) {
      logger.error(`Sheet creation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write message data to Google Sheets
   */
  async writeMessageToSheet(organizationId, data) {
    try {
      if (!this.sheets) {
        logger.warn('Google Sheets not initialized, skipping write');
        return { success: false, reason: 'not_configured' };
      }

      // Get organization's sheet config
      const orgDoc = await db.collection('organizations').doc(organizationId).get();
      const orgData = orgDoc.data();

      if (!orgData?.googleSheets?.spreadsheetId) {
        logger.warn('No Google Sheet connected for organization');
        return { success: false, reason: 'not_connected' };
      }

      const { spreadsheetId, sheetName } = orgData.googleSheets;

      // Prepare row data
      const rowData = [
        data.timestamp?.toISOString() || new Date().toISOString(),
        data.from || '',
        data.channel || '',
        data.message || '',
        data.intent || '',
        data.entities?.name || '',
        data.entities?.phone || data.from || '',
        data.entities?.email || '',
        data.entities?.service_type || '',
        data.entities?.date || '',
        data.entities?.time || '',
        data.response || '',
        data.status || 'processed'
      ];

      // Append to sheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:M`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowData]
        }
      });

      logger.info(`Data written to Google Sheets: ${response.data.updates.updatedRows} row(s)`);

      return {
        success: true,
        spreadsheetId,
        updatedRange: response.data.updates.updatedRange,
        rowsAdded: response.data.updates.updatedRows
      };
    } catch (error) {
      logger.error(`Sheet write error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch write multiple rows
   */
  async batchWriteToSheet(organizationId, dataArray) {
    try {
      const orgDoc = await db.collection('organizations').doc(organizationId).get();
      const orgData = orgDoc.data();

      if (!orgData?.googleSheets?.spreadsheetId) {
        throw new Error('No Google Sheet connected');
      }

      const { spreadsheetId, sheetName } = orgData.googleSheets;

      const rows = dataArray.map(data => [
        data.timestamp?.toISOString() || new Date().toISOString(),
        data.from || '',
        data.channel || '',
        data.message || '',
        data.intent || '',
        data.entities?.name || '',
        data.entities?.phone || '',
        data.entities?.email || '',
        data.entities?.service_type || '',
        data.entities?.date || '',
        data.entities?.time || '',
        data.response || '',
        data.status || 'processed'
      ]);

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:M`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows
        }
      });

      return {
        success: true,
        rowsAdded: response.data.updates.updatedRows
      };
    } catch (error) {
      logger.error(`Batch write error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read data from sheet
   */
  async readFromSheet(organizationId, range = 'A2:M') {
    try {
      const orgDoc = await db.collection('organizations').doc(organizationId).get();
      const orgData = orgDoc.data();

      if (!orgData?.googleSheets?.spreadsheetId) {
        throw new Error('No Google Sheet connected');
      }

      const { spreadsheetId, sheetName } = orgData.googleSheets;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!${range}`
      });

      return {
        success: true,
        values: response.data.values || [],
        count: response.data.values?.length || 0
      };
    } catch (error) {
      logger.error(`Sheet read error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect Google Sheet
   */
  async disconnectSheet(organizationId) {
    try {
      await db.collection('organizations').doc(organizationId).update({
        googleSheets: {
          connected: false,
          disconnectedAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      logger.error(`Sheet disconnect error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SheetsService();