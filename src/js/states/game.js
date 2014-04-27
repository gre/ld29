'use strict';
var Phaser = require('Phaser');
var _ = require("lodash");

var tileSize = 16;

var food = 40;

function step (value, min, max) {
  return min+(max-min)*Math.max(0, Math.min(1, value));
}

var jobs = {
  worker: 0,
  architect: 0,
  harvester: 0
};

var jobsNames = {
  worker: "Worker",
  architect: "Architect",
  harvester: "Harvester"/*,
  aphidFarmer: "Aphid Farmer",
  trophallaxis: "Trophallaxis"*/
};

var pencilModeNames = {
  dig: "Dig",
  move: "Move",
  build: "Build",
  harvest: "Harvest"
};

var JobTask = [
  [ "harvester", "harvest" ],
  [ "architect", "dig" ]
];

var TaskNeedSpecialization = {
  "harvest": true,
  "dig": true
};

var pencilModeShortKey = {
  dig: Phaser.Keyboard.D,
  move: Phaser.Keyboard.M,
  build: Phaser.Keyboard.B,
  harvest: Phaser.Keyboard.H
};

var TasksDefaultPriority = {
  "cleanCorpse": -1,
  "cleanDirt": -1
};

var FoodEnergy = {
  "mushroom": 10,
  "grain": 4
};

var simulationSpeedMsForDays = 0.0001;
var currentPencilMode = "dig";

var TasksEnergy = {
  "dig": 10,
  "harvest": 10,
  "cleanCorpse": 4,
  "cleanDirt": 4
};

var TasksMaxWorkers = {
  "dig": 3,
  "harvester": 1,
  "cleanCorpse": 1,
  "cleanDirt": 1
};

var AntIncr = 0;
var Ant = function (ctx, x, y, group, reverseX) {
  this.id = ++AntIncr;
  this.game = group.game;
  this.job = "worker";
  x *= tileSize;
  y *= tileSize;
  var sprite = group.create(x, y, "ant", 0);
  sprite.animations.add("walk", [ 0, 1 ]);
  this.sprite = sprite;
  this.sprite.ant = this;
  this.route = null;
  this.task = null;
  this.reverseX = reverseX||false;
  this.bornTime = this.game.time.time;
  this.lastMove = this.game.time.time;

  this.moveSpeedFor = _.bind(ctx.moveSpeedFor, ctx);
  this.resolveRoute = _.bind(ctx.resolveRouteAnt, ctx, this);

  this.prevPosition = { x: x, y: y };

  this.sprite.health = 1;
  this.randomlyOffset();
};

Ant.prototype = {
  setJob: function (job) {
    this.job = job;
  },
  die: function () {
    this.sprite.kill();
  },
  busy: function () { // "simple" tasks are not busy
    if (this.game.time.time-this.bornTime < 1000) return true;
  },
  isSpecializedFor: function (task) {
    return _.any(JobTask, function (tuple) {
      return tuple[0] === this.job && tuple[1] === task.type;
    }, this);
  },
  availableForTask: function (task, priority) {
    if (this.task && priority <= this.priority) return false;
    if (TaskNeedSpecialization[task.type]) return this.isSpecializedFor(task);
    return true;
  },
  toString: function () {
    return "[Ant "+this.id+" "+this.job+"]";
  },
  work: function (task, priority) {
    if (this.task) {
      this.stopTask();
    }
    this.task = task;
    this.priority = priority;
    this.route = this.resolveRoute(task.x, task.y);
    if (this.route && this.route.length) {
      this.routeStart();
    }
    this.lastMove = this.game.time.time;
    console.log(this+" new work:", task, priority);
  },
  routeStart: function () {
    this.sprite.rotation = 0;
    this.sprite.animations.play('walk', 10, true);
  },
  routeEnd: function () {
    this.sprite.animations.stop('walk');
    this.randomlyOffset();
  },
  randomlyOffset: function () {
    this.sprite.rotation = this.game.rnd.normal() * 0.1;
  },
  stopTask: function () {
    if (!this.task) return;
    var i = this.task.workers.indexOf(this);
    if (i !== -1) this.task.workers.splice(i, 1);
    this.task = null;
    this.route = null;
    this.priority = -Infinity;
  },
  consumeAndDestroyTaskHandler: function (ctx) {
    var task = this.task;
    var sprite = this.task.target;
    var alpha = Math.max(0, sprite.alpha - 0.001 * ctx.time.elapsed / TasksEnergy.dig);
    sprite.alpha = alpha;
    if (!alpha) {
      sprite.kill();
      this.stopTask();
      ctx.removeTask(task);
      return true;
    }
  },
  taskUpdates: {
    dig: function (ctx) {
      return this.consumeAndDestroyTaskHandler(ctx);
    },
    harvest: function (ctx) {
      return this.consumeAndDestroyTaskHandler(ctx);
    },
    cleanDirt: function (ctx) {
      return this.consumeAndDestroyTaskHandler(ctx);
    },
    cleanCorpse: function (ctx) {
      return this.consumeAndDestroyTaskHandler(ctx);
    }
  },
  lookupForFood: function () {
    // TODO this is done sync, no trip to look for food yet...
    if (food > 0) {
      var target = 0.8 + 0.6 * Math.random();
      var take = Math.min(food, target - this.sprite.health);
      this.sprite.health += take;
      food -= take;
      console.log(this+" eat food "+take);
    }
  },
  foodConsumption: function () {
    return 0.001 * (this.task ? 0.1 : 0.08);
  },
  update: function (ctx) {
    if (!this.task && this.sprite.health < 0.5) {
      this.lookupForFood();
    }
    else if (this.sprite.health < 0.3) {
      this.lookupForFood();
    }
    this.sprite.damage(this.foodConsumption() * ctx.time.elapsed);
    if (this.route && this.route.length) {
      // Walking
      var relativeNextPosition = this.route[0];
      var nextPosition = { x: tileSize*relativeNextPosition.x, y: tileSize*relativeNextPosition.y };

      var speed = ctx.time.elapsed * this.moveSpeedFor(this.sprite); // FIXME where is the tile?
      this.sprite.x = step(speed*(ctx.time.time-this.lastMove), this.prevPosition.x, nextPosition.x);
      this.sprite.y = step(speed*(ctx.time.time-this.lastMove), this.prevPosition.y, nextPosition.y);

      if (this.prevPosition.x < nextPosition.x) {
        this.reverseX = false;
      }
      else if (this.prevPosition.x > nextPosition.x) {
        this.reverseX = true;
      }

      if (this.sprite.x === nextPosition.x && this.sprite.y === nextPosition.y) {
        this.sprite.x = nextPosition.x;
        this.sprite.y = nextPosition.y;
        this.prevPosition = nextPosition;
        this.route.splice(0, 1);
        this.lastMove = ctx.time.time;
        if (!this.route.length) {
          this.route = null;
          this.routeEnd();
        }
      }
    }
    else if (this.task) {
      var taskUpdate = this.taskUpdates[this.task.type];
      if (taskUpdate) taskUpdate.apply(this, arguments);
    }

    this.sprite.alpha = this.task ? 0.8 : 0.9;
    var scaleX = this.reverseX ? -1 : 1;
    if (scaleX !== this.sprite.scale.x) {
      this.sprite.pivot.x = this.reverseX ? this.sprite.width : 0;
      this.sprite.scale.x = scaleX;
    }
  }
};

var Queen = function () {
  Ant.apply(this, arguments);
  this.sprite.frame = 2;
  this.job = "queen";
};

Queen.prototype = Object.create(Ant.prototype);
_.extend(Queen.prototype, {
  busy: function () {
    return true;
  }
});

var Game = function (game) {
  // When a State is added to Phaser it automatically has the following properties set on it, 
  // even if they already exist:
  /*
  this.game;      // a reference to the currently running game
  this.add;       // used to add sprites, text, groups, etc
  this.camera;    // a reference to the game camera
  this.cache;     // the game cache
  this.input;     // the global input manager (you can access this.input.keyboard, this.input.mouse, as well from it)
  this.load;      // for preloading assets
  this.math;      // lots of useful common math operations
  this.sound;     // the sound manager - add a sound, play one, set-up markers, etc
  this.stage;     // the game stage
  this.time;      // the clock
  this.tweens;    // the tween manager
  this.world;     // the game world
  this.particles; // the particle manager
  this.physics;   // the physics manager
  this.rnd;       // the repeatable random number generator
  */
  // You can use any of these from any function within this State.
  // But do consider them as being 'reserved words', i.e. don't create a property for your own game called "world" or you'll over-write the world reference.
};

module.exports = Game;

Game.prototype = {

  setPencilMode: function (mode) {
    currentPencilMode = mode;
  },

  create: function () {
    this.music = this.add.audio('music');
    this.music.loop = true;
    this.music.play();

    this.minGridX = -50;
    this.maxGridX = 50;
    this.minGridY = -30;
    this.maxGridY = 80;
    this.gridW = this.maxGridX - this.minGridX;
    this.gridH = this.maxGridY - this.minGridY;

    this.startTime = this.time.time;
    this.lastBorn = this.time.time;
    this.lastMushroom = this.time.time;
    this.lastGrain = this.time.time;

    this.bornRate = 8000;
    this.mushroomRate = 1000;
    this.grainRate = 10000;

    this.entrance = { x: 0, y: 0 };
    
    this.world.setBounds(
      this.minGridX * tileSize,
      this.minGridY * tileSize,
      this.gridW * tileSize,
      this.gridH * tileSize);

    this.groundGrid = [];
    this.tasks = [];

    this.directionKeys = this.game.input.keyboard.createCursorKeys();

    /*
    _.map(pencilModeShortKey, function (keyCode, mode) {
      var key = this.game.input.keyboard.addKey(keyCode);
      key.onDown.add(function () {
        this.setPencilMode(mode);
      }, this);
    }, this);
    */

    var i;

    this.ui = new Phaser.Group(
      this.game,
      this.stage,
      "ui"
    );

    

    function jobHandler (id, incr) {
      return function () {
        if (incr > 0 && jobs.worker <= 0) return;
        if (incr < 0 && jobs[id] <= 0) return;
        var to = incr > 0 ? id : "worker";
        var from = incr > 0 ? "worker" : id;
        var worker = null;
        this.ants.forEachAlive(function (w) {
          if (worker) return;
          if (w.ant.job === from) {
            worker = w;
          }
        });
        if (!worker) {
          console.log("counts are out of sync...", from, "->", to);
          return;
        }
        worker.ant.setJob(to);
        jobs.worker -= incr;
        jobs[id] += incr;
        this.counts[id].text = ''+jobs[id];
        this.counts.worker.text = ''+jobs.worker;
      };
    }

    i = 0;
    this.counts = {};
    _.each(jobsNames, function (job, id) {
      var textw = 80;
      var x = this.game.width - textw - 20;
      var y = 20 + i * 40;
      this.ui.add(new Phaser.Button(this.game, x-5, y-8-5, 'arrows', jobHandler(id, 1), this, 0, 2, 4, 6));
      this.ui.add(new Phaser.Button(this.game, x-5, y+18-5, 'arrows', jobHandler(id, -1), this, 1, 3, 5, 7));
      var text = new Phaser.Text(this.game, x+20, y, job, { align: 'right', font: '12pt bold Arial', wordWrapWidth: textw, wordWrap: true });
      this.ui.add(text);
      var count = new Phaser.Text(this.game, x+3, y+4, "0", { font: '9pt bold monospace' });
      this.ui.add(count);
      i++;
      this.counts[id] = count;
    }, this);

    this.background = new Phaser.Group(
      this.game,
      this.world,
      "background"
    );
    for (i = this.minGridX; i < this.maxGridX; i ++)
      this.background.create(i * tileSize, this.minGridY * tileSize, "game_bg");

    this.ground = new Phaser.Group(
      this.game,
      this.world,
      "ground"
    );

    this.taskGroup = new Phaser.Group(
      this.game,
      this.world,
      "task"
    );

    this.objects = new Phaser.Group(
      this.game,
      this.world,
      "objects"
    );

    this.ants = new Phaser.Group(
      this.game,
      this.world,
      "ants"
    );
    
    for (var xi = this.minGridX; xi < this.maxGridX; xi++) {
      for (var yi = this.minGridY; yi < this.maxGridY; yi++) {
        var tile;
        var x = xi * tileSize;
        var y = yi * tileSize;
        i = this.groundIndex(xi, yi);
        if (y === 0) {
          if (this.rnd.integerInRange(0, 4) === 0) {
            this.createGrain(xi, yi);
          }
        }
        else if (y > 0) {
          if (this.rnd.integerInRange(0, 90) === 0) {
            tile = this.ground.create(x, y, "rock");
          }
          else if (this.rnd.integerInRange(0, 50) === 0) {
            this.createMushroom(xi, yi);
            tile = this.ground.create(x, y, "dirt", this.rnd.integerInRange(0, 9));
            this.bindDirt(tile, xi, yi, i);
          }
          else {
            tile = this.ground.create(x, y, "dirt", this.rnd.integerInRange(0, 9));
            this.bindDirt(tile, xi, yi, i);
          }
        }
        this.groundGrid[i] = tile;
      }
    }

    _.each([
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4]
    ], function (p) {
      var x = p[0], y = p[1];
      this.groundSprite(x, y).kill();
    }, this);

    this.bornArea = _.filter([
      [0, 6],
      [-1, 6],
      [1, 6],
      [-1, 5],
      [0, 5],
      [1, 5]
    ], function (p, i) {
      var x = p[0], y = p[1];
      this.groundSprite(x, y).kill();
      tile = this.ground.create(x*tileSize, y*tileSize, "royal_room");
      if (i <= 2) {
        this.queen = this.createAnt(x, y, i===0 ? "queen" : null);
      }
      return i > 0;
    }, this);

    this.objects.forEachAlive(function (o) {
      if (o.key === "dirt_pile") {
        o.kill();
      }
    });

    this.camera.focusOnXY(0, 0);

    this.syncWorkersJobCount();

    console.log(this.tasks);
  },

  syncWorkersJobCount: function () {
    var sum = 0;
    this.ants.forEachAlive(function (worker) {
      if (worker.ant.job === "worker")
        sum ++;
    }, this);
    jobs.worker = sum;
    this.counts.worker.text = ''+sum;
  },

  moveSpeedFor: function (worker) {
    return 0.0003;
  },
  
  createMushroom: function (x, y) {
    if (arguments.length === 0) {
      var i;
      for (i=0; i<50; ++i) {
        x = this.rnd.integerInRange(this.minGridX, this.maxGridX);
        y = this.rnd.integerInRange(1, this.maxGridY);
        var sprite = this.groundSprite(x, y);
        if (!sprite || sprite.key === "empty_ground" || sprite.key === "dirt") {
          break;
        }
      }
      if (i === 50) return;
    }
    var tile = this.objects.create(x*tileSize, y*tileSize, "mushroom");
    this.bindMushroom(tile, x, y);
    this.lastMushroom = this.time.time;
    return tile;
  },

  createGrain: function (x, y) {
    if (arguments.length === 0) {
      x = this.rnd.integerInRange(this.minGridX, this.maxGridX);
      y = 0;
    }
    var tile = this.objects.create(x*tileSize, y*tileSize, "grain");
    this.bindGrain(tile, x, y);
    this.lastGrain = this.time.time;
    return tile;
  },

  ways: function (x, y, filterExtension) {
    var self = this;
    var filter = function (p) {
      return self.isWalkable(p.x, p.y);
    };
    if (!filterExtension) {
      filterExtension = _.identity;
    }
    return _.filter([
      { x: x+1, y: y },
      { x: x-1, y: y },
      { x: x,   y: y+1 },
      { x: x,   y: y-1 }
    ], filterExtension(filter));
  },

  isWalkable: function (x, y) {
    if (this.outOfGrid(x, y)) return false;
    if (y < 0) return false;
    if (y === 0) return true;
    var tile = this.groundSprite(x, y);
    if (!tile) return true;
    if (tile.key === "rock" || tile.key === "dirt") return false;
    return true;
  },

  // A* algorithm here...
  shortestPathBetween: function (ax, ay, goalx, goaly, includingDestination) {
    var self = this;

    function positionInHistory (x, y, history) {
      return _.any(history, function (p) {
        return p.x === x && p.y === y;
      });
    }

    function next (x, y, history) {
      return self.ways(x, y, function (f) {
        return function (p) {
          if (positionInHistory(p.x, p.y, history)) return false;
          if (!includingDestination && goalx === p.x && goaly === p.y) return true;
          return f(p);
        };
      });
    }

    function explore (paths, goals, i) {
      if (paths.length === 0) {
        return goals;
      }
      if (i >= 99999) {
        console.log("Path was way too long!");
        return goals;
      }
      var all = [];
      paths.forEach(function (path) {
        var latest = path.path[path.path.length-1];
        var ways = next(latest.x, latest.y, path.path);
        ways.forEach(function (way) {
          var p = {
            cost: path.cost + 1, // FIXME, way may have different costs
            path: path.path.concat([ way ])
          };
          if (goals.length > 0 && goals[0].cost < p.cost)
            return; // We previously found a better goal!

          if (way.x === goalx && way.y === goaly) {
            goals[0] = p;
          }
          else {
            all.push(p);
          }
        });
      });
      return explore(all, goals, i+1);
    }

    return explore([{ cost: 0, path: [{ x: ax, y: ay }] }], [], 0)[0];
  },

  reversePosition: function (x, y) {
    return [
      Math.floor(x / tileSize),
      Math.floor(y / tileSize)
    ];
  },

  onTileSelected: function (tile, f, ctx) {
    tile.inputEnabled = true;
    function handler (sprite, e) {
      if (e.isDown) {
        return f.apply(ctx, arguments);
      }
    }
    tile.events.onInputDown.add(handler);
    tile.events.onInputOver.add(handler);
    tile.events.onInputUp.add(handler);
  },

  bindGrain: function (tile, xi, yi) {
    tile.events.onKilled.add(function () {
      food += FoodEnergy[tile.key];
    });
    this.addTask(tile, "harvest", xi, yi, true);
    /*
    this.onTileSelected(tile, function (sprite, e) {
      if (currentPencilMode === "harvest") {
        this.addTask(tile, "harvest", xi, yi);
      }
    }, this);
    */
  },

  bindMushroom: function (tile, xi, yi) {
    tile.events.onKilled.add(function () {
      food += FoodEnergy[tile.key];
    });
    this.addTask(tile, "harvest", xi, yi, true);
    /*
    this.onTileSelected(tile, function (sprite, e) {
      if (currentPencilMode === "harvest") {
        this.addTask(tile, "harvest", xi, yi);
      }
    }, this);
    */
  },

  bindDirt: function (tile, xi, yi, i) {
    tile.events.onKilled.add(function () {
      delete this.groundGrid[i];
      /*
      // THIS cause bugs, no time to investigate for this minor feature
      var dirt = this.objects.create(tile.x, tile.y, "dirt_pile");
      this.addTask(dirt, "cleanDirt", xi, yi, true);
      */
    }, this);
    this.onTileSelected(tile, function (sprite, e) {
      if (currentPencilMode === "dig") {
        this.addTask(tile, "dig", xi, yi);
      }
    }, this);
  },

  findTask: function (f) {
    for (var i=0; i<this.tasks.length; ++i) {
      if (f(this.tasks[i])) {
        return this.tasks[i];
      }
    }
  },

  removeTask: function (task) {
    var i = this.tasks.indexOf(task);
    task.workers.forEach(function (worker) {
      worker.ant.stopTask();
    });
    if (task.indicator) task.indicator.kill();
    this.tasks.splice(i, 1);
  },

  addTask: function (sprite, type, x, y, invisibleTask) {
    // FIXME: also add a sprite with it, which will hold the "progress" status
    var task = this.findTask(function (task) {
      return sprite === task.target;
    });
    if (task) return null;
    task = {
      target: sprite,
      type: type,
      x: x,
      y: y,
      workers: [],
      maxWorkers: TasksMaxWorkers[type]||1,
      priority: TasksDefaultPriority[type]||1
    };
    if (!invisibleTask) {
      task.indicator = this.taskGroup.create(x * tileSize, y * tileSize, "task", 0);
    }
    this.tasks.push(task);
    return task;
  },

  outOfGrid: function (x, y) {
    return x < this.minGridX || x >= this.maxGridX || y < this.minGridY || y >= this.maxGridY;
  },

  groundIndex: function (x, y) {
    return x + y * this.gridW;
  },

  groundSprite: function (x, y) {
    return this.groundGrid[this.groundIndex(x, y)];
  },

  replaceSprite: function (x, y, sprite) {
    var old = this.groundGrid[this.groundIndex(x,y)];
    this.ground.replace(old, sprite);
    this.groundGrid[this.groundIndex(x,y)] = sprite;
    old.kill();
  },

  createAnt: function (x, y, type) {
    var ant;
    if (type === "queen") {
      ant = new Queen(this, x, y, this.ants);
    }
    else {
      ant = new Ant(this, x, y, this.ants);
      ant.sprite.events.onKilled.add(function () {
        jobs[ant.job] --;
        this.counts[ant.job].text = ''+jobs[ant.job];
        var corpse = this.objects.create(ant.sprite.x, ant.sprite.y, "ant_corpse");
        var p = this.reversePosition(corpse.x, corpse.y);
        this.addTask(corpse, "cleanCorpse", p[0], p[1], true);
      }, this);
    }
    this.syncWorkersJobCount();
    return ant;
  },

  removeAnt: function (ant) {
    ant.kill();
    _.each(this.tasks, function (t) {
      var i = t.workers.inderOf(ant);
      if (i!==-1) t.workers.splice(i, 1);
    });
  },

  moveCamWithMouse: function () {
    function smoothing (x) {
      return 64 * x * x * x;
    }
    var x = smoothing(this.input.position.x / this.game.width - 0.5);
    var y = smoothing(this.input.position.y / this.game.height - 0.5);
    this.camera.setPosition(
      this.camera.x + x,
      this.camera.y + y
    );
  },

  moveCamWithKeyboard: function () {
    var x = this.directionKeys.right.isDown - this.directionKeys.left.isDown;
    var y = this.directionKeys.down.isDown - this.directionKeys.up.isDown;
    var speed = 10;
    this.camera.setPosition(
      this.camera.x + speed * x,
      this.camera.y + speed * y
    );
  },

  getPriority: function (worker, task) {
    return worker.ant.isSpecializedFor(task) ? 99+task.priority : task.priority;
  },

  findTasks: function (worker, tasks) {
    if (!tasks) tasks = this.tasks;
    var p = this.reversePosition(worker.x, worker.y);
    var x = p[0], y = p[1];
    return _.chain(tasks)
      .filter(function (task) {
        var priority = this.getPriority(worker, task);
        return worker.ant.availableForTask(task, priority);
      }, this)
      .sort(_.bind(function (a, b) {
        var dxa = a.x - x;
        var dya = a.y - y;
        var dxb = b.x - x;
        var dyb = b.y - y;
        var pa = this.getPriority(worker, a);
        var pb = this.getPriority(worker, b);
        if (pa > pb) return -1;
        return dxa*dxa+dya*dya > dxb*dxb+dyb*dyb ? 1 : -1;
      }, this))
      .value();
  },

  resolveRouteAnt: function (ant, x, y) {
    var p = this.reversePosition(ant.sprite.x, ant.sprite.y);
    var path = this.shortestPathBetween(p[0], p[1], x, y);
    return path.path;
  },

  update: function () {
    var y = 0;
    this.game.debug.text("days: "+Math.round((this.time.time-this.startTime) * simulationSpeedMsForDays), 20, y+=20, 'white');
    this.game.debug.text("ants: "+this.ants.countLiving(), 20, y+=20, 'white');
    this.game.debug.text("food: "+Math.round(food), 20, y+=20, 'white');
    // this.game.debug.text("mode: "+pencilModeNames[currentPencilMode], 20, y+=20, 'white');
    // this.game.debug.cameraInfo(this.camera, 20, 20, 'white');
    // this.moveCamWithMouse();
    this.moveCamWithKeyboard();

    if (this.time.time - this.lastMushroom > this.mushroomRate) {
      this.createMushroom();
    }
    if (this.time.time - this.lastGrain > this.grainRate) {
      this.createGrain();
    }

    if (this.queen.sprite.alive && this.time.time - this.lastBorn > this.bornRate) {
      var p = _.sample(this.bornArea);
      this.createAnt(p[0], p[1]);
      this.lastBorn = this.time.time;
    }

    var awaitingTasks = _.filter(this.tasks, function (task) {
      return task.workers.length < task.maxWorkers &&
             this.ways(task.x, task.y).length;
    }, this);

    this.ants.forEachAlive(function (worker) {
      if (!worker.ant.busy()) {
        var tasks = this.findTasks(worker, awaitingTasks);
        var task = tasks[0];
        if (task) {
          var p = this.reversePosition(worker.x, worker.y);
          var path = this.shortestPathBetween(p[0], p[1], task.x, task.y); // FIXME: this shoult be done in the findTasks instead
          if (path) {
            worker.ant.work(task, this.getPriority(worker, task));
            task.workers.push(worker);
            if (task.workers.length >= task.maxWorkers) {
              var i = awaitingTasks.indexOf(task);
              awaitingTasks.splice(i, 1);
            }
          }
        }
      }
      /*
      else {
        // FIXME: find something else to do depending on the speciality?
      }
      */
      worker.ant.update(this);
    }, this);
  },

  quitGame: function (pointer) {
    //  Here you should destroy anything you no longer need.
    //  Stop music, delete sprites, purge caches, free resources, all that good stuff.

    //  Then let's go back to the main menu.
    this.game.state.start('MainMenu');
  }

};
