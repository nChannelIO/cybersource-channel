'use strict';

let Channel = require('@nchannel/endpoint-sdk').PromiseChannel;
let soap = require('strong-soap').soap;

class CyberSource extends Channel {
  constructor(...args) {
    super(...args);

    this.validateChannelProfile();
  }

  async insertPaymentCapture(flowContext, payload) {
    return this.runTransaction(payload.doc);
  }

  createClient() {
    let wsdlUri = this.channelProfile.channelSettingsValues.wsdlUri;
    let merchantID = this.channelProfile.channelAuthValues.merchantID;
    let transactionSecurityKey = this.channelProfile.channelAuthValues.transactionSecurityKey;

    return new Promise((res, rej) => {
      soap.createClient(wsdlUri, (err, client) => {
        if (err) {
          rej(err);
        } else {
          res(client);
        }
      });
    }).then(client => {
      client.setSecurity(new soap.WSSecurity(merchantID, transactionSecurityKey, {hasTimeStamp: false, hasTokenCreated: false}));
      client.on('request',  request => {
        this.debug(`Soap Body: ${request}`);
      });
      return client;
    });
  }

  runTransaction(doc) {
    return this.createClient().then(client => {
      return client.runTransaction(doc).then(({result, rawResponse, soapHeader}) => {
        if (result && result.decision === 'ACCEPT' && result.reasonCode === 100) {
          return {
            statusCode: 201,
            payload: result
          };
        } else {
          return {
            statusCode: 400,
            payload: result
          };
        }
      }).catch(this.transactionErrorHandler.bind(this));
    }).catch(this.clientErrorHandler.bind(this));
  }

  clientErrorHandler(err) {
    return {
      statusCode: 400,
      errors: [`An error occurred while creating the soap client: ${err}`]
    };
  }

  transactionErrorHandler(err) {
    return {
      statusCode: 400,
      errors: [`An error occurred while executing the transaction: ${err}`]
    };
  }

  validateChannelProfile() {
    let errors = [];
    if (!this.channelProfile) {
      errors.push("this.channelProfile was not provided");
    }
    if (!this.channelProfile.channelSettingsValues) {
      errors.push("this.channelProfile.channelSettingsValues was not provided");
    }
    if (!this.channelProfile.channelSettingsValues.wsdlUri) {
      errors.push("this.channelProfile.channelSettingsValues.wsdlUri was not provided");
    }
    if (!this.channelProfile.channelAuthValues) {
      errors.push("this.channelProfile.channelAuthValues was not provided");
    }
    if (!this.channelProfile.channelAuthValues.merchantID) {
      errors.push("this.channelProfile.channelAuthValues.merchantID was not provided");
    }
    if (!this.channelProfile.channelAuthValues.transactionSecurityKey) {
      errors.push("this.channelProfile.channelAuthValues.transactionSecurityKey was not provided");
    }
    if (errors.length > 0) {
      throw new Error(`Channel profile validation failed: ${errors}`);
    }
  }
}

module.exports = CyberSource;
