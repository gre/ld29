'use strict';
var Phaser = require('Phaser');
var _ = require("lodash");

var tileSize = 16;

var TasksEnergy = {
  "dig": 10
};

var Ant = function (x, y, group, reverseX) {
  var sprite = group.create(x, y, "ant", 0);
  sprite.animations.add("walk", [ 0, 1 ]);
  this.sprite = sprite;
  this.sprite.ant = this;
  this.route = null;
  this.currentTask = null;
  this.reverseX = reverseX||false;

  sprite.animations.play('walk', 10, true);
};

Ant.prototype = {
  availableForTask: function (task) {
    return !this.currentTask;
  },
  task: function (task, route, target) {
    this.currentTask = task;
    this.targetSprite = target;
    this.route = route;
  },
  stopTask: function () {
    this.currentTask = null;
    this.route = null;
    this.targetSprite = null;
  },
  taskUpdates: {
    dig: function (ctx) {
      var task = this.currentTask;
      var alpha = Math.max(0, this.targetSprite.alpha - 0.001 * ctx.time.elapsed / TasksEnergy.dig);
      this.targetSprite.alpha = alpha;
      if (!alpha) {
        ctx.destroyDirt(this.currentTask.x, this.currentTask.y);
        this.stopTask();
        ctx.removeTask(task);
      }
    }
  },
  update: function (ctx) {
    var scaleX = this.reverseX ? -1 : 1;
    if (scaleX !== this.sprite.scale.x) {
      this.sprite.pivot.x = this.reverseX ? this.sprite.width : 0;
      this.sprite.scale.x = scaleX;
    }
    this.sprite.alpha = this.currentTask ? 0.5 : 1;
    if (this.route && this.route.length) {
      // Walking
      var nextPosition = this.route[0];
      this.sprite.x = nextPosition.x * tileSize;
      this.sprite.y = nextPosition.y * tileSize;
      this.route.splice(0, 1);
    }
    else if (this.currentTask) {
      this.taskUpdates[this.currentTask.type].apply(this, arguments);
    }
  }
};

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

  tileBitmap: function (x, y) {
    var length = this.dirtBitmaps.length;
    var i = (99999999 + x * 9 + x * y * 13) % length;
    return this.dirtBitmaps[i] || this.dirtBitmaps[0];
  },

  create: function () {
    this.minGridX = -40;
    this.maxGridX = 40;
    this.minGridY = -30;
    this.maxGridY = 100;
    this.gridW = this.maxGridX - this.minGridX;
    this.gridH = this.maxGridY - this.minGridY;

    this.entrance = { x: 0, y: 0 };
    
    this.world.setBounds(
      this.minGridX * tileSize,
      this.minGridY * tileSize,
      this.gridW * tileSize,
      this.gridH * tileSize);

    this.dirtBitmaps = [];

    this.directionKeys = this.game.input.keyboard.createCursorKeys();

    var i;

    /*
    for (i=0; i<9; ++i) {
      var dirt = this.add.bitmapData(tileSize, tileSize);
      var r = Math.round(200 + 20 * Math.random());
      var g = Math.round(110 + 20 * Math.random());
      var b = Math.round(80);
      dirt.ctx.fillStyle = "rgb("+[r,g,b]+")";
      dirt.ctx.fillRect(0, 0, tileSize, tileSize);
      this.dirtBitmaps[i] = dirt;
    }
    */

    /*
    this.background = new Phaser.Group(
      this.game,
      this.stage,
      "background"
    );

    this.background.create(0, -100, "game_bg");
    */

    this.stage.setBackgroundColor(0x9fcbe5);

    this.ground = new Phaser.Group(
      this.game,
      this.world,
      "ground"
    );

    this.ants = new Phaser.Group(
      this.game,
      this.world,
      "ants"
    );

    this.taskGroup = new Phaser.Group(
      this.game,
      this.world,
      "task"
    );

    for (i=0; i<30; ++i) {
      this.createAnt(
        this.rnd.integerInRange(this.minGridX, this.maxGridX) * tileSize,
        0
      );
    }

    this.groundGrid = [];

    for (var xi = this.minGridX; xi < this.maxGridX; xi++) {
      for (var yi = this.minGridY; yi < this.maxGridY; yi++) {
        var tile;
        var x = xi * tileSize;
        var y = yi * tileSize;
        i = this.gridIndex(xi, yi);
        if (y > 0) {
          tile = this.ground.create(x, y, "dirt", this.rnd.integerInRange(0, 9));
          tile.inputEnabled = true;
          this.bindDirt(tile, xi, yi, i);
        }
        this.groundGrid[i] = tile;
      }
    }

    this.camera.focusOnXY(0, 0);

    this.tasks = [];
  },

  destroyDirt: function (x, y) {
    this.replaceSprite(x, y, this.ground.create(x * tileSize, y * tileSize, "empty_ground"));
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
    if (y === 0) return true;
    var i = this.gridIndex(x, y);
    var tile = this.groundGrid[i];
    if (!tile) return false;
    if (tile.key !== "empty_ground") return false;
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

  bindDirt: function (tile, xi, yi, i) {
    var self = this;
    function dirtHandler (sprite, e) {
      if (e.isDown) {
        self.addTask("dig", xi, yi);
      }
    }
    tile.events.onInputDown.add(dirtHandler);
    tile.events.onInputOver.add(dirtHandler);
    tile.events.onInputUp.add(dirtHandler);
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
    task.sprite.kill();
    this.tasks.splice(i, 1);
  },

  addTask: function (type, x, y) {
    var task = this.findTask(function (task) {
      return task.x === x && task.y === y && task.type === type;
    });
    if (task) return null;
    task = { type: type, x: x, y: y, workers: [], maxWorkers: 2 };
    task.sprite = this.taskGroup.create(x * tileSize, y * tileSize, "task", 0);
    this.tasks.push(task);
    return task;
  },

  outOfGrid: function (x, y) {
    return x < this.minGridX || x >= this.maxGridX || y < this.minGridY || y >= this.maxGridY;
  },

  gridIndex: function (x, y) {
    return x + y * this.gridW;
  },

  gridSprite: function (x, y) {
    return this.groundGrid[this.gridIndex(x, y)];
  },

  replaceSprite: function (x, y, sprite) {
    var old = this.groundGrid[this.gridIndex(x,y)];
    this.ground.replace(old, sprite);
    this.groundGrid[this.gridIndex(x,y)] = sprite;
    old.kill();
  },

  createAnt: function (x, y) {
    new Ant(x, y, this.ants, Math.random() < 0.5);
  },

  removeAnt: function (ant) {
    ant.kill();
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

  findWorkers: function (task) {
    var allSuitable = [];
    this.ants.forEachAlive(function (ant) {
      if (ant.ant.availableForTask(task)) {
        allSuitable.push(ant);
      }
    });
    var x = task.x * tileSize;
    var y = task.y * tileSize;
    allSuitable.sort(function (a, b) {
      var dxa = a.x - x;
      var dya = a.y - y;
      var dxb = b.x - x;
      var dyb = b.y - y;
      return dxa*dxa+dya*dya > dxb*dxb+dyb*dyb ? 1 : -1;
    });
    return allSuitable;
  },

  update: function () {
    // this.game.debug.cameraInfo(this.camera, 20, 20, 'white');
    // this.moveCamWithMouse();
    this.moveCamWithKeyboard();

    this.tasks.forEach(function (task) {
      if (task.workers.length < task.maxWorkers) {
        if (this.ways(task.x, task.y).length) { // Accessible
          var workers = this.findWorkers(task);
          var remaining = task.maxWorkers - task.workers.length;
          _.find(workers, function (worker) {
            if (remaining <= 0) return true;
            var p = this.reversePosition(worker.x, worker.y);
            var path = this.shortestPathBetween(p[0], p[1], task.x, task.y);
            if (path) {
              remaining --;
              worker.ant.task(task, path.path, this.gridSprite(task.x, task.y));
              task.workers.push(worker);
            }
          }, this);
        }
      }
      else {
        if (!task.sprite.startTime) {
          task.sprite.startTime = this.time.time;
        }
        task.sprite.alpha = 0.5+0.5*Math.cos((this.time.time-task.sprite.startTime) / 200);
      }
    }, this);

    this.ants.forEachAlive(function (ant) {
      ant.ant.update(this);
    }, this);
  },

  quitGame: function (pointer) {
    //  Here you should destroy anything you no longer need.
    //  Stop music, delete sprites, purge caches, free resources, all that good stuff.

    //  Then let's go back to the main menu.
    this.game.state.start('MainMenu');
  }

};
