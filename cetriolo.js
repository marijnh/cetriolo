function byId(id) { return document.getElementById(id); }
var clockText = byId("clock_face").getElementsByTagName("div")[0];

var runningClock;

function updateClock(endTime) {
  var t = +new Date, rem = Math.max(0, endTime - t);
  var secs = Math.round(rem / 1000), mins = 0;
  while (secs >= 60) { ++mins; secs -= 60; }
  var text = mins + ":" + (secs < 10 ? "0" : "") + secs;
  document.title = "Cetriolo (" + text + ")";
  clockText.innerHTML = (mins < 10 ? "0" : "") + text;
  return rem > 0;
}

function setClock(endTime, type) {
  clearInterval(runningClock);
  localStorage.cetrioloClock = endTime + "|" + type;
  function step() {
    if (!updateClock(endTime)) {
      clearInterval(runningClock);
      document.title = "Cetriolo (BEEP BEEP)";
      if (type == "slice" && selectedTask) {
        selectedTask.slices++;
        refreshTask(selectedTask);
        scheduleSave();
      }
    }
  }
  runningClock = setInterval(step, 1000);
  step();
}

window.addEventListener("focus", function() {
  if (/BEEP/.test(document.title)) document.title = "Cetriolo";
}, false);

byId("slice").addEventListener("mousedown", function(e) {
  setClock((+new Date) + 1500000, "slice");
  e.stopPropagation();
}, false);
byId("break").addEventListener("mousedown", function(e) {
  setClock((+new Date) + 300000, "break");
  e.stopPropagation();
}, false);
byId("new_list").addEventListener("mousedown", function(e) {
  addList("New list");
  updateListDelControls();
  scheduleSave();
  e.stopPropagation();
});
byId("search").addEventListener("mousedown", function(e) {
  startSearch();
  e.stopPropagation();
});

function eventTask(e) {
  for (var t = e.target; t; t = t.parentNode)
    if (/\btask\b/.test(t.className)) return t.task;
}
function isEditableText(e) {
  if (e.target.nodeName != "SPAN" || e.target.className != "edit") return;
  var elt = e.target.parentNode, around = elt.parentNode;
  return {val: around.list || around.task, elt: elt};
}

window.addEventListener("mousedown", function(e) {
  if (e.target.nodeName == "TEXTAREA") return;
  if (document.activeElement) document.activeElement.blur();
  var edit = isEditableText(e), task = eventTask(e);
  if (!task) {
    if (edit) {
      e.preventDefault();
      startEditing(edit);
    } else selectTask(null);
    return;
  }
  e.preventDefault();
  var dragging = false, x0 = e.clientX, y0 = e.clientY;
  var offX, offY, dragDummy;
  function move(e) {
    if (!dragging && (Math.abs(x0 - e.clientX) > 4 ||
                      Math.abs(y0 - e.clientY) > 4)) {
      dragging = true;
      var bnd = task.div.getBoundingClientRect();
      task.div.style.visibility = "hidden";
      dragDummy = document.body.appendChild(renderTask(task));
      dragDummy.style.position = "absolute";
      offX = x0 - bnd.left; offY = y0 - bnd.top;
      byId("bin").style.right = byId("archive").style.right = "-210px";
    }
    if (!dragging) return;
    dragDummy.style.left = (e.clientX - offX) + "px";
    dragDummy.style.top = (e.clientY - offY) + "px";
  }
  function up(e) {
    window.removeEventListener("mousemove", move, false);
    window.removeEventListener("mouseup", up, false);
    if (!dragging) {
      if (edit) startEditing(edit);
      else selectTask(task);
      return;
    }

    var cx = e.clientX - offX + dragDummy.offsetWidth / 2;
    var cy = e.clientY - offY + dragDummy.offsetHeight / 2;
    var inBin = isInBox(byId("bin"), cx, cy), inArchive = isInBox(byId("archive"), cx, cy);
    byId("bin").style.right = byId("archive").style.right = "";
    document.body.removeChild(dragDummy);
    task.div.style.visibility = "";

    if (inBin || inArchive) {
      var oldList = removeTask(task);
      if (task.div.parentNode) task.div.parentNode.removeChild(task.div);
      if (inArchive && oldList) addToArchive(task, oldList);
    } else {
      var list = null;
      lists.forEach(function(l) {
        var box = l.div.getBoundingClientRect();
        if (cx < box.left || cx > box.right || cy < box.top) return;
        list = l;
      });
      if (!list) return;
      removeTask(task);
      for (var i = list.tasks.length - 1; i >= 0; --i) {
        var t = list.tasks[i], box = t.div.getBoundingClientRect();
        if (box.top + box.height / 2 < cy) break;
      }
      var nodeAfter = i > -1 ? t.div.nextSibling :
                      list.tasks.length ? list.tasks[0].div : null;
      list.div.insertBefore(task.div, nodeAfter);
      list.tasks.splice(i + 1, 0, task);
    }
    updateListDelControls();
    scheduleSave();
  }
  window.addEventListener("mousemove", move, false);
  window.addEventListener("mouseup", up, false);
}, false);

function startEditing(spec) {
  var oldHeight = spec.elt.offsetHeight;
  spec.elt.innerHTML = "";
  var te = spec.elt.appendChild(document.createElement("textarea"));
  var heightDiff = oldHeight - spec.elt.offsetHeight;
  if (heightDiff != 0) { // Make sure height of paragraph doesn't change
    var d = (heightDiff / 2) + "px";
    te.style.marginTop = te.style.marginBottom = d;
  }
  te.value = spec.val.label;
  te.className = "edit_desc";
  te.rows = 1;
  function updateHeight() {
    while (te.scrollHeight > te.clientHeight) {
      te.rows = Number(te.rows) + 1;
      te.scrollTop = 0;
    }
  }
  updateHeight();
  te.focus();
  te.selectionStart = spec.val.label.length;
  te.addEventListener("input", updateHeight, false);
  te.addEventListener("keydown", function(e) {
    if (e.keyCode == 27 || e.keyCode == 13) {
      e.preventDefault();
      done();
    }
  }, false);
  te.addEventListener("blur", done, false);
  var finished = false;
  function done() {
    if (finished) return;
    finished = true;
    var newVal = te.value, changed = newVal && newVal != spec.val.label;
    if (changed) spec.val.label = newVal;
    spec.elt.innerHTML = "<span>" + htmlEscape(spec.val.label) + "</span>";
    if (changed) scheduleSave();
  }
}

function removeList(list) {
  for (var i = 0; i < lists.length; ++i) {
    if (lists[i] == list) {
      lists.splice(i, 1);
      list.div.parentNode.removeChild(list.div);
      return true;
    }
  }
}

function removeTask(task) {
  for (var i = 0; i < lists.length; ++i) {
    var tasks = lists[i].tasks;
    for (var j = 0; j < tasks.length; ++j) {
      if (tasks[j] == task) {
        tasks.splice(j, 1);
        return lists[i].label;
      }
    }
  }
  for (var i = 0; i < newTasks.length; ++i) {
    if (newTasks[i] == task) {
      var nw = newTasks[i] = newTask("...");
      nw.div = renderTask(nw)
      nw.div.style.marginLeft = "-40px";
      byId("newtask").replaceChild(nw.div, task.div);
      setTimeout(function() {nw.div.style.marginLeft = "";}, 20);
      return null;
    }
  }
}

var selectedTask = null;
function selectTask(task) {
  if (selectedTask) removeClass(selectedTask.div, "selected");
  selectedTask = task;
  if (task) addClass(task.div, "selected");
  scheduleSave();
}

function renderTask(task) {
  dummyElement.innerHTML = "<div class=task><p><span class=edit>" + htmlEscape(task.label) + 
    "</span></p><div class=task_stats>" + task.slices + "</div>";
  var elt = dummyElement.firstChild;
  elt.task = task;
  elt.style.background = task.col;
  var off = (task.wobble * 100) % 10 - 5;
  elt.style.webkitTransform = "rotate(" + (task.wobble - .5) * 3.5 + "deg) translate(" + off + "px, 0px)";
  if (selectedTask == task) addClass(elt, "selected");
  return elt;
}

function refreshTask(task) {
  var newDiv = renderTask(task);
  if (task.div) task.div.parentNode.replaceChild(newDiv, task.div);
  task.div = newDiv;
}

function newTask(label) {
  return {label: label, slices: 0, col: randomColor(.5, .55, .7, .9), wobble: Math.random()};
}

function addList(label) {
  var nw = {label: label, tasks: []};
  lists.push(nw);
  nw.div = byId("workspace").appendChild(renderList(nw));
  return nw;
}

var lists = [];
var newTasks = [];
for (var i = 0; i < 7; ++i) newTasks.push(newTask("..."));

function renderList(list) {
  dummyElement.innerHTML = "<div class=task_list><h2><span class=edit>" +
    htmlEscape(list.label) + "</span></h2></div>";
  var elt = dummyElement.firstChild;
  elt.list = list;
  return elt;
}

function updateListDelControls() {
  lists.forEach(function(list) {
    var found = list.div.getElementsByClassName("del_list")[0];
    if (found && list.tasks.length) {
      found.parentNode.removeChild(found);
    } else if (!found && !list.tasks.length) {
      var p = list.div.appendChild(document.createElement("p"));
      p.className = "del_list";
      p.innerHTML = "<span>(Delete list)</span>";
      p.firstChild.addEventListener("mousedown", function(e) {
        removeList(list);
        scheduleSave();
        e.stopPropagation();
      }, false);
    }
  });
}

function initDisplay() {
  loadData();
  lists.forEach(function(list) {
    list.div = renderList(list);
    byId("workspace").appendChild(list.div);
    list.tasks.forEach(function(task) {
      task.div = list.div.appendChild(renderTask(task));
    });
  });
  newTasks.forEach(function(task) {
    task.div = byId("newtask").appendChild(renderTask(task));
  });
  updateListDelControls();
}
window.onload = initDisplay;

// Search

var curSearch = {text: "", list: "*"};

function startSearch() {
  byId("search_dialog").style.display = "";
  byId("search_text").value = curSearch.text = "";
  curSearch.list = "*";
  var opts = "<option value=\"*\" selected>all</option>";
  lists.forEach(function(list) {
    opts += "<option>" + htmlEscape(list.label) + "</option>";
  });
  byId("search_list").innerHTML = opts;
  updateSearchResult();
}

byId("search_text").addEventListener("input", function(e) {
  if (e.target.value != curSearch.text) {
    curSearch.text = e.target.value;
    updateSearchResult();
  }
});
byId("search_list").addEventListener("change", function(e) {
  if (e.target.value != curSearch.list) {
    curSearch.list = e.target.value;
    updateSearchResult();
  }
});
byId("search_close").addEventListener("mousedown", function(e) {
  byId("search_dialog").style.display = "none";
  e.preventDefault();
});

function updateSearchResult() {
  var found = [], test, isRE = curSearch.text.match(/^\/(.*)\/(i?)$/);
  if (isRE) {
    var re = new RegExp(isRE[1], isRE[2]);
    test = function(str) { return re.test(str); };
  } else {
    var lower = curSearch.text.toLowerCase();
    test = function(str) { return str.toLowerCase().indexOf(lower) > -1; };
  }
  for (var i = 0; i < lists.length; ++i) {
    var list = lists[i];
    if (curSearch.list == "*" || curSearch.list == list.label)
      for (var j = 0; j < list.tasks.length; ++j)
        if (test(list.tasks[j].label))
          found.push(list.tasks[j]);
  }
  var archive = getArchive();
  for (var i = 0; i < archive.length; ++i) {
    var task = archive[i];
    if (curSearch.list == "*" || curSearch.list == task.list)
      if (test(task.label)) found.push(task);
  }
  found.sort(function(a, b) {
    return a.label > b.label ? 1 : a.label == b.label ? 0 : -1;
  });
  var html = "<table>", total = 0;
  found.forEach(function(task, i) {
    html += "<tr data-pos=" + i + "><td>" + htmlEscape(task.label) +
      "</td><td class=slice_col>" + task.slices + "</td><td><button>delete</button></td><td>" +
      (task.list != null ? "<button>unarchive</button>" : "") + "</td></tr>";
    total += task.slices;
  });
  byId("search_total").innerHTML = total;
  byId("search_result").innerHTML = html + "</table>";
  byId("search_result").firstChild.addEventListener("mousedown", function(e) {
    var n = e.target;
    if (n.tagName != "BUTTON") return;
    var row = n.parentNode.parentNode, task = found[Number(row.getAttribute("data-pos"))];
    function remFromArchive() {
      var archive = getArchive();
      var aPos = archive.indexOf(task);
      archive.splice(aPos, 1);
      localStorage.cetrioloArchive = JSON.stringify(archive);
    }
    if (n.innerText == "delete") {
      if (task.list != null) {
        remFromArchive();
      } else {
        removeTask(task);
        task.div.parentNode.removeChild(task.div);
        updateListDelControls();
        scheduleSave();
      }
      row.parentNode.removeChild(row);
    } else { // Unarchive
      remFromArchive();
      var list = null;
      for (var i = 0; i < lists.length; ++i) {
        if (lists[i].label == task.list) {
          list = lists[i];
          break;
        }
      }
      if (!list) list = addList(task.list);
      var tsk = fromSavedData(task);
      list.tasks.push(tsk);
      tsk.div = list.div.appendChild(renderTask(tsk));
      updateListDelControls();
      scheduleSave();
      updateSearchResult();
    }
  }, false);
}

// Save and load

function toSavedData(t, list) {
  return {label: t.label, slices: t.slices, col: t.col, wobble: t.wobble, list: list};
}
function fromSavedData(t) {
  return {label: t.label, slices: t.slices, col: t.col, wobble: t.wobble};
}

var saveActive = null;
function scheduleSave() {
  clearTimeout(saveActive);
  saveActive = setTimeout(saveData, 200);
}
function saveData() {
  var tasks = [], lsts = [], sel = null;
  for (var i = 0; i < lists.length; ++i) {
    var list = lists[i];
    lsts.push(list.label);
    for (var j = 0; j < list.tasks.length; ++j) {
      var t = list.tasks[j];
      if (t == selectedTask) sel = tasks.length;
      tasks.push(toSavedData(t, list.label));
    }
  }
  localStorage.cetriolo = JSON.stringify({tasks: tasks, lists: lsts, selectedTask: sel});
}

var archive = null;
function getArchive() {
  if (archive == null) {
    var val = localStorage.cetrioloArchive;
    if (val) archive = JSON.parse(val);
    else archive = [];
  }
  return archive;
}
function addToArchive(task, list) {
  // FIXME make this scale for big archives
  var archive = getArchive();
  archive.push(toSavedData(task, list));
  localStorage.cetrioloArchive = JSON.stringify(archive);
}

function loadData() {
  var data = localStorage.cetriolo;
  if (data) data = JSON.parse(data);
  else data = {lists: ["Urgent", "Work", "Personal"],
               tasks: [{label: "Figure out Cetriolo", slices: 0, col: "#e94", wobble: .3, list: "Urgent"},
                       {label: "Clean up desk", slices: 0, col: "#77e", wobble: .9, list: "Personal"},
                       {label: "Meditate", slices: 0, col: "#4c7", wobble: .5, list: "Personal"}],
               selectedTask: null};
  lists = [];
  for (var i = 0; i < data.lists.length; ++i)
    lists.push({label: data.lists[i], tasks: []});
  for (var i = 0; i < data.tasks.length; ++i) {
    var task = data.tasks[i];
    var list = lists[data.lists.indexOf(task.list)];
    if (!list) lists.push(list = {label: task.list, tasks: []});
    var newTask = fromSavedData(task);
    if (i == data.selectedTask) selectedTask = newTask;
    list.tasks.push(newTask);
  }
  var clock = localStorage.cetrioloClock, m;
  if (clock && (m = clock.match(/^(\d*)\|(.*)/))) {
    var end = Number(m[1]);
    if (end >= +new Date) setClock(end, m[2]);
  }
}

// Utils

var dummyElement = document.createElement("div");
function htmlEscape(str) {
  dummyElement.textContent = str;
  return dummyElement.innerHTML;
}

function randomColor(l0, l1, s0, s1) {
  if (l0 == null) l0 = .4; if (s0 == null) s0 = .5;
  var lr = (l1 || 1.2) - l0, sr = (s1 || 1) - s0;

  function buildColor(h, s, l) {
    var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
    var m1 = l * 2 - m2;
    function hex(h) {
      while (h > 1.0) h -= 1.0;
      h = h < 0 ? h + 1 : (h > 1 ? h - 1 : h);
      var v = h * 6 < 1 ? m1 + (m2 - m1) * h * 6
            : h * 2 < 1 ? m2
            : h * 3 < 2 ? m1 + (m2 - m1) * (2/3 - h) * 6
            : m1;
      var s = Math.floor(Math.min(v, 1) * 255).toString(16);
      return s.length == 1 ? "0" + s : s;
    }
    return "#" + hex(h + 1/3) + hex(h) + hex(h + 2/3);
  }

  var hue = Math.random();
  var sat = s0 + Math.random() * sr;
  var light = l0 + Math.random() * lr;
  return buildColor(hue, sat, light);
}

function addClass(node, cls) {
  var cur = node.className;
  if (!RegExp("\\b" + cls + "\\b").test(cur))
    node.className = cur + " " + cls;
}
function removeClass(node, cls) {
  node.className = node.className.replace(RegExp("\\s*\\b" + cls + "\\b", "g"), "");
}

function isInBox(elt, x, y) {
  var box = elt.getBoundingClientRect();
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
