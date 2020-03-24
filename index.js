const PLUGIN_ID = 'signalk-maretron-proprietary'
const PLUGIN_NAME = 'Maretron Proprietary PGNs'

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = [];

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'Adds support for Maretron Proprietary PGNs';

  plugin.schema = {
    type: "object",
    properties: {
      dcBreakerCurrent: {
        type: 'boolean',
        title: 'PGN 65284 DC Breaker Current',
        default: false
      },
      switchStatusCounter: {
        type: 'boolean',
        title: 'PGN 130836 Switch Status Counter',
        default: false
      },
      switchStatusTimer: {
        type: 'boolean',
        title: 'PGN 130837 Switch Status Timer',
        default: false
      }
    }
  }

  plugin.start = function(options) {
    n2kCallback = (msg) => {
      try {
        //let enc_msg = null

        let fields = msg['fields']

        if (options.dcBreakerCurrent && msg.pgn == 65284 && fields['Manufacturer Code'] == 'Maretron') {
          let keys = ['Breaker Current']
          handleDelta(fields, keys)

        } else if (options.switchStatusCounter && msg.pgn == 130836 && fields['Manufacturer Code'] == 'Maretron') {
          let keys = ['Start Date', 'Start Time', 'OFF Counter', 'ON Counter', 'ERROR Counter']
          handleDelta(fields, keys, 'statusCounter')

        } else if (options.switchStatusTimer && msg.pgn == 130837 && fields['Manufacturer Code'] == 'Maretron') {
          let keys = ['Start Date', 'Start Time', 'Accumulated OFF Period', 'Accumulated ON Period', 'Accumulated ERROR Period']
          handleDelta(fields, keys, 'statusTimer')
        }
      } catch (e) {
        console.error(e)
      }
    }
    app.on("N2KAnalyzerOut", n2kCallback)
  }

  plugin.stop = function() {
    if (n2kCallback) {
      app.removeListener("N2KAnalyzerOut", n2kCallback)
      n2kCallback = undefined
    }
  }
  return plugin;

  function handleDelta(fields, keys, suffix) {
    let basePath = 'electrical.switches.bank.' + fields['Bank Instance'] + '.' + fields['Indicator Number']
    if (suffix) basePath += '.' + suffix

    let values = (keys.map(key => ({
      "path": basePath + '.' + toCamelCase(key),
      "value": fields.hasOwnProperty(key) ? key.startsWith('Accumulated') ? timerFormat(fields[key]) : fields[key] : ''
    })))

    let delta = {
      "updates": [{
        "values": values
      }]
    }

    app.debug(JSON.stringify(delta))
    app.handleMessage(PLUGIN_ID, delta)
  }

  function toCamelCase(input) {

    let regex = /[A-Z\xC0-\xD6\xD8-\xDE]?[a-z\xDF-\xF6\xF8-\xFF]+|[A-Z\xC0-\xD6\xD8-\xDE]+(?![a-z\xDF-\xF6\xF8-\xFF])|\d+/g;
    let inputArray = input.match(regex);

    let result = "";
    for (let i = 0, len = inputArray.length; i < len; i++) {

      let currentStr = inputArray[i];

      let tempStr = currentStr.toLowerCase();

      if (i != 0) {
        // convert first letter to upper case (the word is in lowercase)
        tempStr = tempStr.substr(0, 1).toUpperCase() + tempStr.substr(1);
      }

      result += tempStr;
    }

    return result;
  }

  function timerFormat(seconds) {

    let days = Math.floor(seconds / 86400)
    let daysr = seconds % 86400

    let hours = Math.floor(daysr / 3600)
    let hoursr = daysr % 3600

    let minutes = Math.floor(hoursr / 60)
    seconds = hoursr % 60

    return days + ':' + hours + ':' + minutes + ':' + seconds
  }
};
