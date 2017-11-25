/**
 * Responds to any HTTP request that can provide a "message" field in the body.
 *
 * @param {!Object} req Cloud Function request context.
 * @param {!Object} res Cloud Function response context.
 */

const fs = require('fs');
const path = require('path');
const storage = require('@google-cloud/storage')();
const config = require( "./config.json" );
const xml2js = require('xml2js');

exports.api2xml = function api2xml(req, res) {

  storage
    .bucket(config.hubs_xml_bucket)
    .getFiles({
      autoPaginate: false
    })
    .then(results => {
      const files = results[0];
      files.forEach(file => {
        console.log(`Downloading ${file.name}.`);

        const tempLocalFilename = `/tmp/${path.parse(file.name).base}`;

        file
          .download({ destination: tempLocalFilename })
          .catch((err) => {
            console.log('Failed to download file.', err);
          })
          .then(() => {
            xmlFileToJs(tempLocalFilename, (err, obj) => {
              if (err) {
                throw (err);
              }

              var kioskid = obj.config['kiosk'][0].$.id;
              /* make api call here */

              var modules = [];
              modules.push({ module: { $: { id: 'another module', path: 'module path' }}});

              var library = obj.config['content-library'][0];
              library.modules = modules;

              jsToXmlFile(tempLocalFilename, obj, (err) => {
                if (err) {
                  console.log(err);
                }

                file.bucket.upload(tempLocalFilename, { destination: file.name })
                  .catch((err) => {
                    console.error('Failed to upload modified xml.', err);
                    return Promise.reject(err);
                });
              });
            });
          });
      });
    });

  res.status(200).send('Success');
};

function xmlFileToJs(filepath, cb) {
  fs.readFile(filepath, 'utf8', (err, xmlStr) => {
      if (err) {
        throw (err);
      }
      xml2js.parseString(xmlStr, {}, cb);
  });
}

function jsToXmlFile(filepath, obj, cb) {
  var builder = new xml2js.Builder();
  var xml = builder.buildObject(obj);
  fs.writeFile(filepath, xml, cb);
}
