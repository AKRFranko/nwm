module.exports = function(dependencies) {
  // modules
  var NWM = dependencies.NWM,
      XK = dependencies.keysymdef,
      Xh = dependencies.Xh,
      child_process = require('child_process'),
      which = dependencies.which;

  // instantiate nwm and configure it
  var nwm = new NWM();

  // resolved using node-which from a preset list, see bottom of the file
  var bestAvailableTerm = 'xterm';

  // load layouts
  var layouts = dependencies.layouts;
  nwm.addLayout('tile', layouts.tile);
  nwm.addLayout('monocle', layouts.monocle);
  nwm.addLayout('wide', layouts.wide);
  nwm.addLayout('grid', layouts.grid);

  // convinience functions for writing the keyboard shortcuts
  function currentMonitor() {
    return nwm.monitors.get(nwm.monitors.current);
  }

  function moveToMonitor(window, currentMonitor, otherMonitorId) {
    if (window) {
      window.monitor = otherMonitorId;
      // set the workspace to the current workspace on that monitor
      var otherMonitor = nwm.monitors.get(otherMonitorId);
      window.workspace = otherMonitor.workspaces.current;
      // rearrange both monitors
      currentMonitor.workspaces.get(currentMonitor.workspaces.current).rearrange();
      otherMonitor.workspaces.get(otherMonitor.workspaces.current).rearrange();
    }
  }

  function resizeWorkspace(increment) {
    var workspace = currentMonitor().currentWorkspace();
    workspace.setMainWindowScale(workspace.getMainWindowScale() + increment);
    workspace.rearrange();
  }

  // KEYBOARD SHORTCUTS
  // Change the base modifier to your liking e.g. Xh.Mod4Mask if you just want to use the meta key without Ctrl
  var baseModifier = Xh.Mod4Mask; // Win key

  if (process.argv.indexOf('--xephyr') > -1) {
    baseModifier = Xh.Mod4Mask | Xh.ControlMask; // Win + Ctrl
  }

  var envWithLang = JSON.parse(JSON.stringify(process.env));

  envWithLang.LANGUAGE = 'en_US.utf8';
  envWithLang.LANG = 'en_US.utf8';
  envWithLang.LC_ALL = 'en_US.utf8';


  function exec(command, onErr) {
    var term = child_process.spawn(command, [], { env: envWithLang });

    term.stderr.setEncoding('utf8');
    term.stderr.on('data', function(data) {
      if (/^execvp\(\)/.test(data)) {
        if (onErr) {
          onErr();
        }
      }
    });
  }

  var keyboard_shortcuts = [
    {
      key: [1, 2, 3, 4, 5, 6, 7, 8, 9], // number keys are used to move between screens
      callback: function(event) {
        currentMonitor().go(String.fromCharCode(event.keysym));
      }
    },
    {
      key: [1, 2, 3, 4, 5, 6, 7, 8, 9], // with shift, move windows between workspaces
      modifier: ['shift'],
      callback: function(event) {
        var monitor = currentMonitor();
        monitor.windowTo(monitor.focused_window, String.fromCharCode(event.keysym));
      }
    },
    {
      key: 'Return', // enter key launches xterm
      modifier: ['shift'],
      callback: function(event) {
        exec(bestAvailableTerm);
      }
    },
    {
      key: 'c', // c key closes the current window
      modifier: ['shift'],
      callback: function(event) {
        var monitor = currentMonitor();
        if (monitor.focused_window) {
          nwm.wm.killWindow(monitor.focused_window);
        }
      }
    },
    {
      key: 'space', // space switches between layout modes
      callback: function(event) {
        var monitor = currentMonitor();
        var workspace = monitor.currentWorkspace();
        workspace.layout = nwm.nextLayout(workspace.layout);
        // monocle hides windows in the current workspace, so unhide them
        monitor.go(monitor.workspaces.current);
        workspace.rearrange();
      }
    },
    {
      key: ['h', 'F10'], // shrink master area
      callback: function(event) {
        resizeWorkspace(-5);
      }
    },
    {
      key: ['l', 'F11'], // grow master area
      callback: function(event) {
        resizeWorkspace(+5);
      }
    },
    {
      key: 'Tab', // tab makes the current window the main window
      callback: function(event) {
        var monitor = currentMonitor();
        var workspace = monitor.currentWorkspace();
        workspace.mainWindow = monitor.focused_window;
        workspace.rearrange();
      }
    },
    {
      key: 'comma', // moving windows between monitors
      modifier: ['shift'],
      callback: function(event) {
        var monitor = currentMonitor();
        var window = nwm.windows.get(monitor.focused_window);
        if (window) { // empty if no windows
          moveToMonitor(window, monitor, nwm.monitors.next(window.monitor));
        }
      }
    },
    {
      key: 'period', // moving windows between monitors
      modifier: ['shift'],
      callback: function(event) {
        var monitor = currentMonitor();
        var window = nwm.windows.get(monitor.focused_window);
        if (window) { // empty if no windows
          moveToMonitor(window, monitor, nwm.monitors.prev(window.monitor));
        }
      }
    },
    {
      key: 'j', // moving focus
      callback: function() {
        var monitor = currentMonitor();
        if (monitor.focused_window && nwm.windows.exists(monitor.focused_window)) {
          var window = nwm.windows.get(monitor.focused_window);
          do {
            var previous = nwm.windows.prev(window.id);
            window = nwm.windows.get(previous);
          }
          while (window.workspace != monitor.workspaces.current);
          console.log('Current', monitor.focused_window, 'previous', window.id);
          monitor.focused_window = window.id;
          nwm.wm.focusWindow(window.id);
        }
      }
    },
    {
      key: 'k', // moving focus
      callback: function() {
        var monitor = currentMonitor();
        if (monitor.focused_window && nwm.windows.exists(monitor.focused_window)) {
          var window = nwm.windows.get(monitor.focused_window);
          do {
            var next = nwm.windows.next(window.id);
            window = nwm.windows.get(next);
          }
          while (window.workspace != monitor.workspaces.current);
          console.log('Current', monitor.focused_window, 'next', window.id);
          monitor.focused_window = window.id;
          nwm.wm.focusWindow(monitor.focused_window);
        }
      }
    },
    {
      key: 'q', // quit
      modifier: ['shift'],
      callback: function() {
        process.exit();
      }
    },
    {
      key: 'BackSpace',
      callback: function() {
        currentMonitor().goBack();
      }
    }
  ];

  // take each of the keyboard shortcuts above and make add a key using nwm.addKey
  keyboard_shortcuts.forEach(function(shortcut) {
    var callback = shortcut.callback;
    var modifier = baseModifier;
    // translate the modifier array to a X11 modifier
    if (shortcut.modifier) {
      if (shortcut.modifier.indexOf('shift') > -1) {
        modifier = modifier | Xh.ShiftMask;
      }
      if (shortcut.modifier.indexOf('ctrl') > -1) {
        modifier = modifier | Xh.ControlMask;
      }
    }
    // add shortcuts
    if (Array.isArray(shortcut.key)) {
      shortcut.key.forEach(function(key) {
        nwm.addKey({ key: XK[key], modifier: modifier }, callback);
      });
    } else {
      nwm.addKey({ key: XK[shortcut.key], modifier: modifier }, callback);
    }
  });

  // START
  var terms = [
    'sakura',
    'rxvt',
    'urxvt',
    'xterm'
  ];

  function findTerm(onDone) {
    var name = terms.shift();
    which(name, function(err, filepath) {
      if (err || !filepath) {
        findTerm(onDone);
      } else {
        onDone(null, name);
      }
    });
  }

  findTerm(function(err, term) {
    bestAvailableTerm = term;
    nwm.start(function() {});
  });

};
