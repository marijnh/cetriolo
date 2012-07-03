# Cetriolo

Cetriolo is a simple HTML5 (i.e. HTML+JS, works in recent browsers)
task management plus time-slicing app.

The name is a riff on [Pomodoro][1] — 'cetriolo' is the Italian word
for 'cucumber'.

[1]: http://www.pomodorotechnique.com/

You create new tasks by dragging the handles on the left of the screen
into the workspace. You delete/archive them by dragging them into the
areas marked 'Archive' and 'Throw away'. Select tasks by clicking on
them, update their description by clicking on the description of a
selected task.

Similarly, task lists are renamed by clicking on their description.

The state of your task list and timer are saved to `localStorage`, and
restored the next time the page is loaded. I hope to move to
[`remoteStorage`][2] for this at some point in the future.

[2]: http://unhosted.org/

The clock on the top of the screen can be used to time a slice of work
(25 minutes) or a break (5 minutes). I've found that, as the Pomodoro
technique advocates, alternating 25 minute slices of focused work and
5 minute breaks is quite helpful.

When a slice timer runs out, the slice count of the currently selected
task is incremented by one.

I'm not a disciplined practitioner of Pomodoro in general, and find it
a bit heavy on rules. This thing is just a tool that I use to support
my own workflow, and in no way claim that it represents the Pomodoro
approach.

There is (usually) a demo checkout of this app at http://marijnhaverbeke.nl/cetriolo/

Inspired by [Taskboard][3].

[3]: http://jancborchardt.net/taskboard-lite/
