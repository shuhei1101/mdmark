# Xvfb の画面の空いた位置を 1 秒ごとにクリックし、Webview にユーザーの操作を与える
import sys, time
from Xlib import X, display
from Xlib.ext import xtest
d = display.Display(sys.argv[1])
x, y = int(sys.argv[2]), int(sys.argv[3])
while True:
    xtest.fake_input(d, X.MotionNotify, x=x, y=y)
    xtest.fake_input(d, X.ButtonPress, 1)
    xtest.fake_input(d, X.ButtonRelease, 1)
    d.sync()
    time.sleep(1)
