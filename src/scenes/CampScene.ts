import Phaser from 'phaser';
import { createTextures } from '../art/sprites';

export const VIEW_W = 960;
export const VIEW_H = 540;

/** A painted backdrop for the camp menus. */
export class CampScene extends Phaser.Scene {
  constructor() {
    super('camp');
  }

  create(): void {
    createTextures(this);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xe9a46a).setOrigin(0);
    this.add.rectangle(0, 0, VIEW_W, 200, 0x8fb3c9).setOrigin(0);
    this.add.tileSprite(0, 160, VIEW_W, 220, 'hills').setOrigin(0);
    this.add.tileSprite(0, 140, VIEW_W, 260, 'far-trees').setOrigin(0).setTilePosition(200, 0);
    this.add.tileSprite(0, 80, VIEW_W, 340, 'mid-trees').setOrigin(0).setTilePosition(480, 0);
    this.add.tileSprite(0, 400, VIEW_W, 140, 'ground').setOrigin(0);

    const g = this.add.graphics();
    // Cabin (the outfitter)
    g.fillStyle(0x5b3a22).fillRect(560, 300, 190, 110);
    g.fillStyle(0x3b2416).fillTriangle(545, 300, 655, 235, 765, 300);
    g.fillStyle(0x2a1a10).fillRect(640, 345, 34, 65);
    g.fillStyle(0xffd27a).fillRect(585, 330, 30, 24).fillRect(700, 330, 30, 24);
    g.fillStyle(0xead9b5).fillRect(590, 280, 130, 18);
    this.add.text(655, 289, 'TRAILHEAD OUTFITTERS', { fontFamily: 'monospace', fontSize: '11px', color: '#3b2416' }).setOrigin(0.5);
    // Trader's tent
    g.fillStyle(0x9c8a5a).fillTriangle(790, 410, 860, 320, 930, 410);
    g.fillStyle(0x5a4c2c).fillTriangle(845, 410, 860, 370, 875, 410);

    // Campfire with flickering flames
    g.fillStyle(0x4a3020).fillRect(470, 400, 50, 8);
    const flame = this.add.triangle(495, 400, 0, 0, 14, -34, 28, 0, 0xff8a2a).setOrigin(0.5, 1);
    this.tweens.add({ targets: flame, scaleY: 0.7, scaleX: 1.15, duration: 180, yoyo: true, repeat: -1 });

    this.add.image(430, 410, 'hunter-orange').setOrigin(0.5, 1);
  }
}
