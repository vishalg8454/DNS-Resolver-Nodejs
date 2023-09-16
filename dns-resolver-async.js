import dgram from "dgram";
import { resolveDNS as x } from "./dns-resolver-utility.js";

const rootServer = "198.41.0.4";

function encodeURL(str) {
  const temp =
    str
      .split(".")
      .map(
        (s) =>
          s.length.toString(16).padStart(2, 0) +
          s
            .split("")
            .map((c) => c.charCodeAt(0).toString(16).padStart(2, 0))
            .join("")
      )
      .join("") + "00";

  return temp;
}

let ms = "";

function decodeDomain(str) {
  let ans = "";
  const octet = str.substring(0, 2);
  const decimal = parseInt(octet, 16);
  const isPointer = decimal & 192; //checking if first 2 bits are set
  if (octet === "00") {
    return "";
  }
  if (isPointer) {
    const doubleOctet = str.substring(0, 4);
    const mask = 16383;
    const doubleDecimal = parseInt(doubleOctet, 16);
    const offset = doubleDecimal & mask;
    ans += decodeDomain(ms.substring(offset * 2));
  } else {
    //it is sequence of labels
    let ptr = 2;
    let local = "";
    for (let i = 0; i < decimal; i++) {
      const temp = str.substring(ptr, ptr + 2);
      const ascii = parseInt(temp, 16);
      local += String.fromCharCode(ascii);
      ptr += 2;
    }
    ans += local + "." + decodeDomain(str.substring(ptr));
  }
  return ans;
}

function decodeARecord(str) {
  let ans = "";
  for (let i = 0; i < str.length; i += 2) {
    const temp = str.substring(i, i + 2);
    const ascii = parseInt(temp, 16);
    ans += ascii;
    if (i < str.length - 2) {
      ans += ".";
    }
  }
  return ans;
}

async function resolveDNS(hostname, serverAddress) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    console.log("Resolving DNS for ", hostname, "at ", serverAddress);
    const hexString =
      "001600000001000000000000" + encodeURL(hostname) + "00010001";

    const messageBuffer = Buffer.from(hexString, "hex");
    const serverPort = 53; // Replace with the port of your UDP server

    client.send(
      messageBuffer,
      0,
      messageBuffer.length,
      serverPort,
      serverAddress,
      (error) => {
        if (error) {
          console.error("Error sending message:", error);
        } else {
          // console.log(
          // `Message sent to ${serverAddress}:${serverPort}: ${hexString}`
          // );
        }
      }
    );

    // Listen for messages from the server
    client.on("message", async (msg, rinfo) => {
      client.close(); // Close the client socket after receiving the message
      const response = msg.toString("hex");
      ms = response;
      const headerlength = 24;
      const header = response.substring(0, headerlength);
      const questionCount = parseInt(header.substring(8, 12), 16);
      const answerCount = parseInt(header.substring(12, 16), 16);
      const authorityCount = parseInt(header.substring(16, 20), 16);
      const additionalCount = parseInt(header.substring(20, 24), 16);
      let body = response.substring(headerlength);
      let name = "";
      while (1) {
        const firstOctet = body.substring(0, 2);
        const decimal = parseInt(firstOctet, 16);
        if (firstOctet === "00") {
          break;
        }
        for (let i = 0; i < decimal; i++) {
          const temp = body.substring(2 + i * 2, 4 + i * 2);
          const ascii = parseInt(temp, 16);
          name += String.fromCharCode(ascii);
        }
        body = body.substring(2 + decimal * 2);
      }
      let rest = body.substring(2);
      const queryType = rest.substring(0, 4);
      const queryClass = rest.substring(4, 8);
      rest = rest.substring(8);
      // console.log("Query name:", name);
      // console.log("Query type:", queryType);
      // console.log("Query class:", queryClass);
      // console.log("Answer count:", answerCount);
      // console.log("Authority count:", authorityCount);
      // console.log("Additional count:", additionalCount);
      console.log(
        "Authority:",
        authorityCount,
        "Additional:",
        additionalCount,
        "Answer:",
        answerCount
      );

      if (answerCount > 0) {
        // console.log("Answer");
        for (let i = 0; i < answerCount; i++) {
          const firstOctet = rest.substring(0, 2);
          const decimal = parseInt(firstOctet, 16);
          const isPointer = decimal & 192; //checking if first 2 bits are set
          let nameData = "";
          let nameLength = 0; //becaue name can be pointer or sequence of labels
          let name = "";
          if (isPointer) {
            nameLength = 4;
            nameData = rest.substring(0, nameLength);
            name = decodeDomain(nameData);
          } else {
            // nameLength = decimal * 2 + 6;
            // nameData = rest.substring(0, nameLength);
            // name = decodeDomain(nameData);

            let temp = rest;
            while (1) {
              const octet = temp.substring(0, 2);
              if (octet == "00") {
                nameData += "00";
                nameLength += 2;
                break;
              }
              let len = parseInt(octet, 16);
              temp = temp.substring(2);
              nameData += octet;
              nameLength += 2;
              nameData += temp.substring(0, 2 * len);
              temp = temp.substring(2 * len);
              nameLength += 2 * len;
            }
            name = decodeDomain(nameData);
          }
          const type = rest.substring(nameLength, nameLength + 4);
          const class_ = rest.substring(nameLength + 4, nameLength + 8);
          const ttl = rest.substring(nameLength + 8, nameLength + 16);
          const dataLength = rest.substring(nameLength + 16, nameLength + 20);
          const rdata = rest.substring(
            nameLength + 20,
            nameLength + 20 + parseInt(dataLength, 16) * 2
          );
          rest = rest.substring(nameLength + 20 + parseInt(dataLength, 16) * 2);
          // console.log("Type:", type);
          if (type === "0001") {
            // console.log("Name:", name);
            // console.log("Type:", type);
            // console.log("Class:", class_);
            // console.log("Ttl:", ttl);
            // console.log("DataLength:", dataLength);
            // console.log();
            resolve(decodeARecord(rdata));
            console.log();
            console.log("FOUND!");
            console.log("Decoded name:", name);
            // console.log("decoded A Record", decodeARecord(rdata));
            return;
          }
          if (type === "0005") {
            const CNAME = decodeDomain(rdata).slice(0, -1);
            console.log("CNAME:", CNAME);
            console.log();
            const ip = await resolveDNS(CNAME, "198.41.0.4");
            resolve(ip);
            return;
          }
        }
      }

      // console.log("Authority");
      for (let i = 0; i < authorityCount; i++) {
        const firstOctet = rest.substring(0, 2);
        const decimal = parseInt(firstOctet, 16);
        const isPointer = decimal & 192; //checking if first 2 bits are set
        let nameData = "";
        let nameLength = 0; //becaue name can be pointer or sequence of labels
        let name = "";
        if (isPointer) {
          nameLength = 4;
          nameData = rest.substring(0, nameLength);
          name = decodeDomain(nameData);
        } else {
          // nameLength = decimal * 2 + 6;
          // nameData = rest.substring(0, nameLength);
          // name = decodeDomain(nameData);
          // console.log("nameData", nameData)
          // console.log("decimal", decimal)
          // console.log("firstOctet", firstOctet)

          let temp = rest;
          while (1) {
            const octet = temp.substring(0, 2);
            if (octet == "00") {
              nameData += "00";
              nameLength += 2;
              break;
            }
            let len = parseInt(octet, 16);
            temp = temp.substring(2);
            nameData += octet;
            nameLength += 2;
            nameData += temp.substring(0, 2 * len);
            temp = temp.substring(2 * len);
            nameLength += 2 * len;
          }
          name = decodeDomain(nameData);
        }
        const type = rest.substring(nameLength, nameLength + 4);
        const class_ = rest.substring(nameLength + 4, nameLength + 8);
        const ttl = rest.substring(nameLength + 8, nameLength + 16);
        const dataLength = rest.substring(nameLength + 16, nameLength + 20);
        const rdata = rest.substring(
          nameLength + 20,
          nameLength + 20 + parseInt(dataLength, 16) * 2
        );
        rest = rest.substring(nameLength + 20 + parseInt(dataLength, 16) * 2);
        // console.log("Name:", name);
        // console.log("Type:", type);
        // console.log("Class:", class_);
        // console.log("Ttl:", ttl);
        // console.log("DataLength:", dataLength);
        let decodedDomain = decodeDomain(rdata).slice(0, -1);

        console.log("Using Authoritaive nameserver:", decodedDomain);
        console.log();
        if (type === "0002") {
          //NS record
          // const ip = await resolveDNS(decodedDomain, rootServer);
          const ip = await x(decodedDomain, rootServer);
          resolve(resolveDNS(hostname, ip));
          // resolve(resolveDNS(hostname, decodedDomain));
          break;
        }
        // console.log();
      }

      // console.log("Additional");
      for (let i = 0; i < additionalCount; i++) {
        const firstOctet = rest.substring(0, 2);
        const decimal = parseInt(firstOctet, 16);
        const isPointer = decimal & 192; //checking if first 2 bits are set
        let nameData = "";
        let nameLength = 0; //becaue name can be pointer or sequence of labels
        let name = "";
        if (isPointer) {
          nameLength = 4;
          nameData = rest.substring(0, nameLength);
          name = decodeDomain(nameData);
        } else {
          // nameLength = decimal * 2 + 6;
          // nameData = rest.substring(0, nameLength);
          // name = decodeDomain(nameData);

          let temp = rest;
          while (1) {
            const octet = temp.substring(0, 2);
            if (octet == "00") {
              nameData += "00";
              nameLength += 2;
              break;
            }
            let len = parseInt(octet, 16);
            temp = temp.substring(2);
            nameData += octet;
            nameLength += 2;
            nameData += temp.substring(0, 2 * len);
            temp = temp.substring(2 * len);
            nameLength += 2 * len;
          }
          name = decodeDomain(nameData);
        }
        const type = rest.substring(nameLength, nameLength + 4);
        const class_ = rest.substring(nameLength + 4, nameLength + 8);
        const ttl = rest.substring(nameLength + 8, nameLength + 16);
        const dataLength = rest.substring(nameLength + 16, nameLength + 20);
        const rdata = rest.substring(
          nameLength + 20,
          nameLength + 20 + parseInt(dataLength, 16) * 2
        );
        rest = rest.substring(nameLength + 20 + parseInt(dataLength, 16) * 2);
        if (type === "0001") {
          // console.log("Name:", name);
          // console.log("Type:", type);
          // console.log("Class:", class_);
          // console.log("Ttl:", ttl);
          // console.log("DataLength:", dataLength);
          // console.log("Decoded nameserver:", decodeDomain(rdata));
          // console.log();
          // if (type === "0001") {
          //   resolveDNS(hostname, decodeARecord(rdata));
          //   break;
          // }
        }
      }
    });
  });
}

// const rootServer = "199.7.83.42"
// const rootServer = "199.43.135.53";
// const rootServer = "142.250.192.5"
// const hostname = "www.example.com";
// const hostname = "ride.swiggy.com";
// const hostname = "ns-ride-swiggy-com-1968196709.ap-southeast-1.elb.amazonaws.com"
// const hostname = "dns.cloudflare.com";
// const hostname = "a.gtld-servers.net";
// const hostname = "amazon.in";
// const hostname = "www.amazon.in";
// const hostname = "fresh.amazon.com";
// const hostname = "amazon.in";
// const hostname = "tp.c95e7e602-frontier.amazon.in"
// const hostname = "www.woohoo.in";
// const hostname = "woohoo.in";

async function main() {
  const args = process.argv;
  let hostname = args[2];
  if (!hostname) {
    hostname = "www.example.com";
  }
  const result = await resolveDNS(hostname, rootServer);
  console.log("IP Address:", result);
}
main();
