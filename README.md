# DNS-Resolver-Nodejs
## This project tries to implement the DNS Recursive Resolver in NodeJS. No external modules or dependencies is used.

## How to run the script?

```bash
# Example installation steps
git clone https://github.com/vishalg8454/DNS-Resolver-Nodejs.git
cd DNS-Resolver-Nodejs
node dns-resolver-async.js www.example.com
```

## Sample Output for www.example.com
```bash
Resolving DNS for  www.example.com at  198.41.0.4
Authority: 13 Additional: 14 Answer: 0
Using Authoritaive nameserver: a.gtld-servers.net

Resolving DNS for  www.example.com at  192.5.6.30
Authority: 2 Additional: 0 Answer: 0
Using Authoritaive nameserver: a.iana-servers.net

Resolving DNS for  www.example.com at  199.43.135.53
Authority: 0 Additional: 0 Answer: 1

FOUND!
Decoded name: www.example.com.
IP Address: 93.184.216.34
```
Note: 198.41.0.4 is hardcoded as the root-server. You can try different values listed here https://www.iana.org/domains/root/servers
