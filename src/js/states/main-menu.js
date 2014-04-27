'use strict';

var MainMenu = function (game) {
  this.music = null;
  this.playButton = null;
};

module.exports = MainMenu;

MainMenu.prototype = {
  create: function () {
    //  We've already preloaded our assets, so let's kick right into the Main Menu itself.
    //  Here all we're doing is playing some music and adding a picture and button
    //  Naturally I expect you to do something significantly better :)

    this.music = this.add.audio('titleMusic');
    this.music.loop = true;
    this.music.play();

    this.add.sprite(0, 0, 'menu_background');

    this.playButton = this.add.button(300, 240, 'play', this.startGame, this, 1, 0);
  },

  update: function () {
    //  Do some nice funky main menu effect here
  },

  startGame: function (pointer) {
    //  Ok, the Play Button has been clicked or touched, so let's stop the music (otherwise it'll carry on playing)
    this.music.stop();

    //  And start the actual game
    this.game.state.start('Game');
  }

};
