'''
Simple webserver for local testing; authentication based on https://gist.github.com/fxsjy/5465353 and http://stackoverflow.com/a/8153189
'''
from argparse import ArgumentParser

import SocketServer
from SimpleHTTPServer import SimpleHTTPRequestHandler
from BaseHTTPServer import BaseHTTPRequestHandler
import base64

# Global variable used for authentication
AUTH_KEY = None

class AuthHandler(SimpleHTTPRequestHandler):
    ''' Main class to present webpages and authentication. '''
    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_AUTHHEAD(self):
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm=\"Restricted\"')
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        ''' Present frontpage with user authentication. '''
        if self.headers.getheader('Authorization') == None:
            self.do_AUTHHEAD()
            pass
        elif self.headers.getheader('Authorization') == 'Basic ' + AUTH_KEY:
            SimpleHTTPRequestHandler.do_GET(self)
            pass
        else:
            self.do_AUTHHEAD()
            pass


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--username")
    parser.add_argument("--password")
    args = parser.parse_args() 
    
    if args.username and args.password:
        AUTH_KEY = base64.b64encode(args.username + ':' + args.password)
    
    if AUTH_KEY:    
        httpd = SocketServer.TCPServer(("", args.port), AuthHandler)
    else:
        httpd = SocketServer.TCPServer(("", args.port), SimpleHTTPRequestHandler)

    print "Serving at port ", args.port
    if AUTH_KEY:
        print "HTTP authentication key: " + AUTH_KEY
    httpd.serve_forever()