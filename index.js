const http = require('http')
const httpProxy = require('http-proxy')
const fs = require('fs')
const jsonFormat = require('json-format')
const { URL } = require('url');
const mkdirp = require('mkdirp')
const zlib = require('zlib')

const loggedHosts = ['localhost:3030']
const ignoredMethods = ['OPTIONS']



const outputFolder = './output/' + new Date().toISOString().substr(0, 19)
mkdirp(outputFolder, err => {
  if (err)
    throw err
})

const jsonConfig = {
  type: 'space',
  size: 2
}

const proxy = httpProxy.createProxyServer({});

let count = 0
proxy.on('proxyRes', (proxyRes, req, res) => {

  const headers = req.headers
  const method = req.method

  if (!loggedHosts.includes(headers.host) || ignoredMethods.includes(method)) {
    return
  }
  const url = new URL(req.url)
  const trimmedPath = url.pathname.replace(/\//g, '')

  const id = ++count

  function makeFilePath(type, extension) {
    return `${outputFolder}/${(id + '').padStart(4, 0)}-${type}-${method}-${trimmedPath}.${extension}`
  }

  const reqFilePath = makeFilePath('REQ', 'txt')
  let content = req.url
  if (headers['content-type'] === 'application/json' && req.data) {
    content += '\n' + jsonFormat(JSON.parse(req.data), jsonConfig)
  }

  fs.writeFile(reqFilePath, content, err => {
    if (err) {
      console.error(err)
    }
    console.log(id, ' Saved REQUEST:', reqFilePath)
  })

  let resBody = new Buffer('')
  let dataCount = 0
  proxyRes.on('data', data => {
    dataCount++
    resBody = Buffer.concat([resBody, data]);
  })

  proxyRes.on('end', () => {
    new Promise((resolve, reject) => {
      if (proxyRes.headers['content-encoding'] === 'gzip') {
        zlib.unzip(resBody, (err, result) => {
          if (err) {
            reject(err)
          }
          resolve(result)
        })
      } else {
        resolve(resBody)
      }
    }).then(body => {
      const text = body.toString('utf8')
      let content
      if (proxyRes.headers['content-type'].includes('application/json') && text) {
        try {
          content = jsonFormat(JSON.parse(text), jsonConfig)
        } catch (e) {
          console.error('Failed to parse JSON ', method, ' ', req.url)
          console.error(text)
          content = text
        }
      } else {
        content = text
      }
      const resFilePath = makeFilePath('RES', 'json')
      fs.writeFile(resFilePath, content, err => {
        if (err) {
          console.error(err)
        }
        console.log(id, ' Saved RESPONSE:', resFilePath)
      })
    })

  })
})
//
// Create your custom server and just call `proxy.web()` to proxy
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//
const server = http.createServer((req, res) => {
  // You can define here your custom logic to handle the request
  // and then proxy the request.  
  const url = new URL(req.url)
  if (req.method === 'HEAD') {
    // Some weird request when booting Cypress' Chrome
    // So we handle them here
    res.end()
    return
  }
  req.on('data', data => {
    const text = data.toString('utf8')
    req.data = text
  })
  proxy.web(req, res, { target: url.origin })

  let logged = 'LOGGED'
  if (!loggedHosts.includes(req.headers.host) || ignoredMethods.includes(req.method)) {
    logged = 'UNLOGGED'
    return
  }
  console.log(logged, ' - Proxying: ', req.method, ' - ', req.url)
})

console.log('Listening on port 5050')
server.listen(5050)

/*
127.0.0.1
::1
localhost
*/