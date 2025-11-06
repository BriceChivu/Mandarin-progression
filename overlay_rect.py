from Cocoa import NSApplication, NSWindow, NSColor, NSBorderlessWindowMask, NSFloatingWindowLevel
from Cocoa import NSBackingStoreBuffered, NSRect, NSView, NSBezierPath

class RectangleView(NSView):
    def drawRect_(self, rect):
        NSColor.clearColor().set()
        NSBezierPath.fillRect_(rect)
        NSColor.redColor().set()  # outline color
        path = NSBezierPath.bezierPathWithRect_(rect)
        path.setLineWidth_(3)
        path.stroke()

app = NSApplication.sharedApplication()
frame = NSRect((0, 250), (1210, 680))  # position and size

window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
    frame, NSBorderlessWindowMask, NSBackingStoreBuffered, False
)
window.setOpaque_(False)
window.setBackgroundColor_(NSColor.clearColor())
window.setLevel_(NSFloatingWindowLevel)  # always on top
window.setIgnoresMouseEvents_(True)  # so clicks pass through
window.setContentView_(RectangleView.alloc().init())

window.makeKeyAndOrderFront_(None)
app.run()

