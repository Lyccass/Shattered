import Phaser from 'phaser';
import { ForestPackPreviewScene } from '../../scenes/ForestPackPreviewScene';

new Phaser.Game({type:Phaser.AUTO,parent:'game',width:window.innerWidth,height:window.innerHeight,
  backgroundColor:'#12262b',render:{antialias:true},scale:{mode:Phaser.Scale.RESIZE},scene:[ForestPackPreviewScene]});
