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
      var promises = [];
      files.forEach((file, index) => {

        const trackid = index;
        console.log(`${trackid}: Found '${file.name}'.`);

        if (file.name.endsWith('.xml')) {
          const tempLocalFilename = `/tmp/${path.parse(file.name).base}`;

          var p = file
            .download({ destination: tempLocalFilename })
            .then(() => {
              console.log(`${trackid}: Downloaded '${file.name}' to '${tempLocalFilename}'.`);
              return xmlFileToJs(tempLocalFilename);
            })
            .then((obj) => {
              console.log(`${trackid}: Read temporary file '${tempLocalFilename}'`);
              if (obj.config === undefined){
                console.log(`${trackid}: File '${file.name}' is not a kiosk xml file, skipping.`);
                return Promise.resolve(false);
              }
              var kioskid = obj.config['kiosk'][0].$.id;
              console.log(`${trackid}: Fetching data for kiosk '${kioskid}'.`);
              /* make api call here */

              var modules = [];
              modules.push({ module: { $: { id: 'another module', path: 'module path' }}});

              var library = obj.config['content-library'][0];
              library.modules = modules;

              return jsToXmlFile(tempLocalFilename, obj);
            })
            .then((saved) => {
              if (saved) {
                console.log(`${trackid}: Saved temporary file '${tempLocalFilename}'`);
                return file.bucket
                  .upload(tempLocalFilename, { destination: file.name })
                  .then(() => {
                    console.log(`${trackid}: Uploaded '${file.name}' to bucket`);
                  })
                  .catch((err) => {
                    console.log(`${trackid}: Failed to upload modified xml.`, err);
                    return Promise.reject(err);
                  });
              } else {
                return Promise.resolve();
              }
            })
            .catch((err) => {
              console.log(`${trackid}: Failed to process file.`, err);
              return Promise.reject(err);
            });

            promises.push(p);
          } else {
            console.log(`${trackid}: File '${file.name}' is not an xml file, skipping.`);
          }
      });

      return Promise.all(promises)
        .catch((err) => {
          return Promise.reject(err);
        })
    })
    .then(() => {
      res.status(200).send('Success');
    })
    .catch((err) => {
      res.status(500).send(`Failed: ${err}`);
    });
};

function xmlFileToJs(filepath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, 'utf8', (err, xmlStr) => {
      if (err) {
        reject (err);
      }
      xml2js.parseString(xmlStr, {}, (err, obj) => {
        if (err) {
          reject (err);
        }
        resolve(obj);
      });
    });
  });
}

function jsToXmlFile(filepath, obj) {
  return new Promise((resolve, reject) => {
    var builder = new xml2js.Builder();
    var xml = builder.buildObject(obj);
    fs.writeFile(filepath, xml, (err) => {
      if (err){
        reject(err);
      }
      resolve(true);
    });
  });
}
