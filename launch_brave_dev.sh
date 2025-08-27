#!/bin/bash
# Launch Brave with localhost access enabled (using default profile)
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser \
  --disable-web-security \
  --allow-running-insecure-content \
  --disable-features=VizDisplayCompositor \
  --allow-insecure-localhost

