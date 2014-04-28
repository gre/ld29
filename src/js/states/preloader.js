'use strict';

var query = require("../query");

var Preloader = function (game) {
  this.background = null;
  this.preloadBar = null;
  this.ready = false;
};

module.exports = Preloader;

Preloader.prototype = {

  preload: function () {
    // These are the assets we loaded in Boot.js
    // A nice sparkly background and a loading progress bar
    this.background = this.add.sprite(0, 0, 'preloaderBackground');
    this.preloadBar = this.add.sprite(200, 400, 'preloaderBar');

    //  This sets the preloadBar sprite as a loader sprite.
    //  What that does is automatically crop the sprite from 0 to full-width
    //  as the files below are loaded in.
    this.load.setPreloadSprite(this.preloadBar);

    //  Here we load the rest of the assets our game needs.
    //  As this is just a Project Template I've not provided these assets, swap them for your own.
    this.load.spritesheet('ant', 'assets/img/ant.png', 16, 16, 4);
    this.load.image('ant_corpse', 'assets/img/ant_corpse.png');
    this.load.image('empty_ground', 'assets/img/empty_ground.png');
    this.load.image('task', 'assets/img/task.png');
    this.load.image('rock', 'assets/img/rock.png');
    this.load.image('aphid', 'assets/img/aphid.png');
    this.load.image('cursor', 'assets/img/cursor.png');
    this.load.image('royal_room', 'assets/img/royal_room.png');
    this.load.image('food_stock', 'assets/img/food_stock.png');
    this.load.image('grain', 'assets/img/grain.png');
    this.load.spritesheet('mushroom', 'assets/img/mushroom.png', 16, 16, 4);
    this.load.image('dirt_pile', 'assets/img/dirt_pile.png');
    this.load.image('game_bg', 'assets/img/game_bg.png');
    this.load.image('retry', 'assets/img/retry.png');
    this.load.spritesheet('dirt', 'assets/img/dirt.png', 16, 16, 10);
    this.load.spritesheet('arrows', 'assets/img/arrows.png', 20, 20, 8);
    this.load.image('menu_background', 'assets/img/menu_background.jpg');
    this.load.spritesheet('play', 'assets/img/play.png', 200, 50, 2);
    this.load.audio('titleMusic', ['assets/audio/intro.mp3']);
    this.load.audio('music', ['assets/audio/music.mp3']);
    this.load.bitmapFont('font', 'assets/fonts/font.png', 'assets/fonts/font.fnt');
    //  + lots of other required assets here
  },

  create: function () {
    //  Once the load has finished we disable the crop because we're going to sit in the update loop for a short while as the music decodes
    this.preloadBar.cropEnabled = false;
  },

  update: function () {
    //  You don't actually need to do this, but I find it gives a much smoother game experience.
    //  Basically it will wait for our audio file to be decoded before proceeding to the MainMenu.
    //  You can jump right into the menu if you want and still play the music, but you'll have a few
    //  seconds of delay while the mp3 decodes - so if you need your music to be in-sync with your menu
    //  it's best to wait for it to decode here first, then carry on.

    //  If you don't have any music in your game then put the game.state.start line into the create function and delete
    //  the update function completely.

    if (this.cache.isSoundDecoded('music') && this.cache.isSoundDecoded('titleMusic') && this.ready === false) {
      this.ready = true;
      if (query.autoplay) {
        this.game.state.start('Game');
      }
      else {
        this.game.state.start('MainMenu');
      }
    }
  }

};
