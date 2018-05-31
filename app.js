const { Cap, decoders } = require("cap")
const throttle = require("lodash.throttle")
const DEBUG = process.env.DASH_DEBUG || false

const Server = function() {
  var self = this
  const cap = new Cap()
  const buffer = new Buffer(65536)

  this.dashButtons = {}

  this.register = function(button) {
    if (DEBUG)
      console.log(
        `Registering a new dash button to listen for with mac address ${
          button.mac
        }`
      )
    button.callback = throttle(button.callback, 5000)
    self.dashButtons[button.mac.toUpperCase()] = button
    return self
  }

  this.packetReceived = function(nbytes, trunc) {
    const decodedPacket = decoders.Ethernet(buffer)
    // ARP
    if (decodedPacket.info.type === 2054) {
      if (DEBUG) {
        console.log("ARP request detected...")
        console.log(decodedPacket.info.srcmac.toUpperCase())
      }
      // Check if incoming packet's MAC Address matches a registered button
      const button = self.dashButtons[decodedPacket.info.srcmac.toUpperCase()]
      if (button && button.callback) {
        console.log("Registered Dash button click detected! Firing callback!")
        button.callback(decodedPacket)
      }
    }
  }

  // Start listening to the provided ip address for packets
  this.start = function(ip) {
    const device = Cap.findDevice(ip)
    if (!device) {
      throw Error(
        `No device found at ${ip}. Here are all the devices available =>\n${JSON.stringify(
          Cap.deviceList(),
          null,
          2
        )}`
      )
    }

    console.log(`Listening for ARP requests on ${ip}`)
    cap.open(device, "", 10 * 1024 * 1024, buffer)

    try {
      cap.setMinBytes(0)
    } catch (e) {
      console.log(e)
    }

    // Register a callback when a packet is detected
    cap.on("packet", self.packetReceived)
    process.on("SIGINT", self.stop)
  }

  // Shut down the server gracefully on CTRL-C
  this.stop = function() {
    console.log("Shutting down")
    cap.removeListener("packet", self.packetReceived)
    cap.close()
  }
}

const DashButton = function(mac, callback) {
  this.mac = mac
  this.callback = callback
}

module.exports = {
  DashButton,
  Server
}
