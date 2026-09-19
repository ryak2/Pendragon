import { PENSelectLists } from "../apps/select-lists.mjs";
import { PendragonStatusEffects } from "../apps/status-effects.mjs";
import { PENUtilities } from "../apps/utilities.mjs";
import { PENactorItemDrop } from "./actor-itemDrop.mjs";

//Extend the base Actor Class
export class PendragonActor extends Actor {
  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCommonData(actorData);
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
    this._prepareEncounterData(actorData);
    this._prepareManorData(actorData);
    this._prepareBaronyData(actorData);
  }

  // Prepare Character type specific data
  _prepareCharacterData(actorData) {
    if (actorData.type !== "character") return;
    const systemData = actorData.system;
    //Set basic object IDs
    systemData.statTotal = 0;
    systemData.fidelitas = 0;
    systemData.fervor = 0;
    systemData.adoratio = 0;
    systemData.civilitas = 0;
    systemData.honor = 0;
    systemData.winter = 0;

    //Set stats max
    const culture = actorData.items.find((itm) => itm.type === "culture");

    for (let [key, stat] of Object.entries(actorData.system.stats)) {
      stat.max = 18 + stat.culture;
      if (culture) {
        stat.max = culture.system.stats[key].max ?? 18;
      }
      stat.total = Math.min(stat.total, stat.max);
      systemData.statTotal = systemData.statTotal + Number(stat.value);
    }

    //Calculate passive Glory
    systemData.appeal = 0;
    systemData.trait = 0;
    systemData.passion = 0;
    systemData.solVal = 0;
    systemData.obese = 0;
    systemData.damageMod = 0;

    //Calculate passive Glory for Fair Appeal
    if (systemData.stats.app.total > 18) {
      systemData.appeal = 50;
    } else if (systemData.stats.app.total > 15) {
      systemData.appeal = 25;
    } else if (systemData.stats.app.total > 12) {
      systemData.appeal = 10;
    }

    //Calculate passive Glory for Standard of Living
    if (systemData.sol === "ordinary") {
      systemData.solVal = 10;
    } else if (systemData.sol === "rich") {
      systemData.solVal = 20;
    } else if (systemData.sol === "superlative") {
      systemData.solVal = 20;
    }

    //Calculate passive Glory for obese
    if (systemData.stats.siz.growth > 2) {
      systemData.obese = 20;
    }

    for (let i of actorData.items) {
      if (i.type === "trait") {
        if (i.system.total > 19 || i.system.oppvalue > 19) {
          systemData.trait = systemData.trait + 25;
        } else if (i.system.total > 15 || i.system.oppvalue > 15) {
          systemData.trait = systemData.trait + 15;
        }
      } else if (i.type === "passion") {
        systemData[i.system.court] = systemData[i.system.court] + Math.min(20, Number(i.system.total));
        if (i.system.total > 19) {
          systemData.passion = systemData.passion + 25;
        } else if (i.system.total > 15) {
          systemData.passion = systemData.passion + 15;
        }
      }
    }

    //Check that Ideals are active and apply benefits
    systemData.passglory.ideals = 0;
    for (let i of actorData.items) {
      if (i.type === "ideal") {
        i.system.active = true;
        for (let rItm of i.system.require) {
          let actItm = actorData.items.filter((itm) => itm.flags?.Pendragon?.pidFlag?.id === rItm.pid)[0];
          if (!actItm) {
            i.system.active = false;
          } else {
            if (rItm.score < 0) {
              if (actItm.system.total > 20 + rItm.score) {
                i.system.active = false;
              }
            } else {
              if (actItm.system.total < rItm.score) {
                i.system.active = false;
              }
            }
          }
        }
        if (i.system.active) {
          systemData.passglory.ideals = systemData.passglory.ideals + i.system.glory;
          systemData.armour = systemData.armour + i.system.armour;
          /*let damAdj = i.system.dam.toUpperCase();
          if (damAdj.split("D").length > 1) {
            systemData.damage = systemData.damage + Number(damAdj.split("D")[0]);
          } else {
            systemData.damageMod = systemData.damageMod + i.system.dam;
          }*/
          systemData.move = systemData.move + i.system.move;
          systemData.hp.max = systemData.hp.max + i.system.hp;
          systemData.healRate = systemData.healRate + i.system.hr;
        }
      }
    }

    //Convert skilltype to the name of the Skill
    let skillType = PENSelectLists.getWeaponTypes();
    let rangeType = PENSelectLists.getWeaponRange();
    for (let i of actorData.items) {
      if (i.type === "weapon") {
        i.system.skillName = skillType[i.system.skill];
        if (i.system.melee) {
          i.system.rangeName = "";
        } else {
          i.system.rangeName = rangeType[i.system.range].charAt(0);
        }

        //Add the skill score to the weapon matched on skill/weaponType and add the skill ID to the weapon
        for (let j of actorData.items) {
          if (j.type === "skill" && j.system.weaponType === i.system.skill) {
            i.system.total = j.system.total;
            i.system.sourceID = j._id;
          }
        }

        //Calculate the damage for the weapon for the actor
        let damageDice = 0;
        let damageFlatMod = 0;
        let damageFormula = "";
        if (i.system.damageChar === "h") {
          //If damage source is horse use the horse's charge damage
          damageFormula = systemData.horseChgDam;
          if (Number(i.system.damageMod) != 0) {
            damageFormula = damageFormula + "+" + Number(i.system.damageMod) + "D6";
          }
        } else {
          if (i.system.damageChar === "c") {
            //If damage source is character use the character Dam as number of D6
            damageDice = systemData.damage;
          } else if (i.system.damageChar === "b") {
            //If damage source is brawling use the character Dam as flat mod
            damageFlatMod = systemData.damage;
          }

          damageFlatMod = Number(damageFlatMod) + Number(i.system.damageBonus) + Number(systemData.damageMod);

          damageDice = Math.min(Number(damageDice) + Number(i.system.damageMod), Number(i.system.damageMax));
          //a two-handed grip adds +2D6 damage
          damageDice = damageDice + this.getTwoHandedBonus(i);
          // make this mildly nicer
          damageFormula = `${damageDice}D6`;
          if (damageFlatMod > 0) {
            damageFormula = `${damageDice}D6+${damageFlatMod}`;
          }
          if (damageFlatMod < 0) {
            damageFormula = `${damageDice}D6${damageFlatMod}`;
          }
        }
        i.system.damage = damageFormula;
      }
    }

    if (game.settings.get("Pendragon", "trackWnd")) {
      systemData.hp.value = systemData.hp.max - systemData.totalWounds - systemData.aggravDam - systemData.deterDam;
    }
    systemData.hp.unconscious = Math.round(systemData.hp.max / 4);
    systemData.tap = Math.min(100, systemData.passion) + Math.min(100, systemData.trait);
    systemData.passive =
      Number(systemData.tap) +
      Number(systemData.appeal) +
      Number(systemData.passglory.ideals) +
      Number(systemData.passglory.estate) +
      Number(systemData.passglory.other) +
      Number(systemData.solVal) +
      Number(systemData.obese) +
      Number(systemData.passglory.inyear);

    // If hp <=0 we probably should do something
    // code used to set DYING/DEBILITATED/UNCONSCIOUS etc here but creating effects during prepare can end up with duplicates or cycles
    // TOR2E emits a warning to chat 'actor expected to have STATUS' which if we don't spam chat at wrong time may be useful
  }

  // Prepare NPC and follower type specific data.
  _prepareNpcData(actorData) {
    if (!["npc", "follower"].includes(actorData.type)) return;
    // Make modifications to data here. For example:
  }

  //Prepare Encounter Dats
  _prepareEncounterData(actorData) {
    if (!["encounter"].includes(actorData.type)) return;
  }

  //Prepare Manor Data
  _prepareManorData(actorData) {
    if (!["manor"].includes(actorData.type)) return;
    //All currently done in the data model, held here just in case.
  }

  //Prepare Barony Data
  _prepareBaronyData(actorData) {
    if (!["barony"].includes(actorData.type)) return;
    //All currently done in the data model, held here just in case.
  }

  // Prepare Common type specific data.
  _prepareCommonData(actorData) {
    if (!["npc", "character", "follower"].includes(actorData.type)) return;
    actorData.system.statTotal = 0;
    // Handle stats scores, adding labels to stats
    for (let [key, stat] of Object.entries(actorData.system.stats)) {
      stat.label = game.i18n.localize(CONFIG.PENDRAGON.stats[key]) ?? key;
      stat.labelShort = game.i18n.localize(CONFIG.PENDRAGON.statsAbbreviations[key]) ?? key;
      stat.total =
        Number(stat.value) +
        Number(stat.culture) +
        Number(stat.create) +
        Number(stat.poison) +
        Number(stat.disease) +
        Number(stat.sol) +
        Number(stat.age) +
        Number(stat.major) +
        Number(stat.winter);
    }

    //If NPC is Spriggan
    if (actorData.type === "npc") {
      let pid = actorData.flags?.Pendragon?.pidFlag?.id;
      if (pid) {
        let position = pid.search("spriggan");
        if (position > -1) {
          actorData.system.stats.siz.total = actorData.system.stats.siz.total - actorData.system.woundTotal;
        }
      }
    }

    // Make modifications to data here. For example:
    const systemData = actorData.system;
    systemData.hp.majorWnd = systemData.stats.con.total;

    //If NPC or follower, and manual HP have been entered then override max HP calc
    if (["npc", "follower"].includes(actorData.type)) {
      if (systemData.manMaxHP != 0) {
        systemData.hp.max = systemData.manMaxHP;
      } else {
        systemData.hp.max = systemData.stats.siz.total + systemData.stats.con.total + systemData.hp.adj;
      }
      if (systemData.manKnockdown != 0) {
        systemData.hp.knockdown = systemData.manKnockdown;
      } else {
        systemData.hp.knockdown = systemData.stats.siz.total;
      }
      if (systemData.manUnconscious != 0) {
        systemData.hp.unconscious = systemData.manUnconscious;
      } else {
        systemData.hp.unconscious = Math.round(systemData.hp.max / 4);
      }
    } else {
      systemData.hp.max = systemData.stats.siz.total + systemData.stats.con.total + systemData.hp.adj;
      systemData.hp.unconscious = Math.round(systemData.hp.max / 4);
      systemData.hp.knockdown = systemData.stats.siz.total;
    }

    systemData.damage = Math.round((systemData.stats.str.total + systemData.stats.siz.total) / 6);
    systemData.horseDam = "";
    systemData.horseChgDam = "";
    systemData.healRate = Math.round(systemData.stats.con.total / 5);
    systemData.move = Math.round((systemData.stats.str.total + systemData.stats.dex.total) / 2) + 5;
    systemData.reputation = "";

    //Loop through all items to see if they have impact
    systemData.totalWounds = 0;
    let glory = 0;
    let armour = 0;
    let shield = 0;
    for (let i of actorData.items) {
      if (i.type === "wound") {
        //Ignore wounds with a negative value
        systemData.totalWounds = systemData.totalWounds + Math.max(i.system.value, 0);
      } else if (i.type === "history") {
        glory = Number(glory) + Number(i.system.glory);
      } else if (i.type === "armour" && i.system.equipped) {
        //If armour is equipped
        if (i.system.type) {
          //And type = true then add AP to armour
          armour = armour + Number(i.system.ap);
        } else {
          //Otherwise type = false then add AP to shield
          shield = shield + Number(i.system.ap);
        }
      } else if (i.type === "horse" && i.id === actorData.flags?.Pendragon?.currentHorse) {
        //Get horse damage from an equipped horse,
        systemData.horseDam = i.system.damage;
        systemData.horseChgDam = i.system.chargeDmg;
      }
    }
    //Calculate current HP then check for Near Death
    if (game.settings.get("Pendragon", "trackWnd")) {
      systemData.hp.value = systemData.hp.max - (systemData.woundTotal ? systemData.woundTotal : 0);
    }
    //If Manual Glory used, add to Glory total
    if (game.settings.get("Pendragon", "manualGlory")) {
      glory = glory + systemData.manualGlory;
    }
    if (glory < 3000) {
      systemData.reputation = game.i18n.localize("PEN.unproven");
    } else if (glory < 4000) {
      systemData.reputation = game.i18n.localize("PEN.veteran");
    } else if (glory < 6000) {
      systemData.reputation = game.i18n.localize("PEN.respected");
    } else if (glory < 8000) {
      systemData.reputation = game.i18n.localize("PEN.notable");
    } else if (glory < 12000) {
      systemData.reputation = game.i18n.localize("PEN.renowned");
    } else if (glory < 16000) {
      systemData.reputation = game.i18n.localize("PEN.illustrious");
    } else if (glory < 32000) {
      systemData.reputation = game.i18n.localize("PEN.extraordinary");
    } else if (glory >= 32000) {
      systemData.reputation = game.i18n.localize("PEN.legendary");
    }

    systemData.glory = glory;
    systemData.gloryPrestige = Math.floor(glory / 1000) - systemData.prestige;
    systemData.armour = armour;
    systemData.shield = shield;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== "character") return;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (data.stats) {
      for (let [key, stat] of Object.entries(data.stats)) {
        data[key] = foundry.utils.deepClone(stat);
      }
    }

    // Add level for easier access, or fall back to 0.
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== "npc") return;

    // Process additional NPC data here.
  }

  /** @override */
  static async create(data, options = {}) {
    //If dropping from compendium check to see if the actor already exists in game.actors and if it does then get the game.actors details rather than create a copy
    if (options.fromCompendium) {
      let tempActor = await game.actors.filter(
        (actr) => actr.flags?.Pendragon?.pidFlag?.id === data.flags?.Pendragon?.pidFlag?.id,
      )[0];
      if (tempActor) {
        return tempActor;
      }
    }

    let vision = game.settings.get("Pendragon", "tokenVision");
    //When creating an actor set basics including tokenlink, bars, displays sight
    if (data.type === "character") {
      if (typeof data.img === "undefined") {
        data.img = "systems/Pendragon/assets/Icons/default_actor_dark.webp";
      }
      data.prototypeToken = foundry.utils.mergeObject(
        {
          actorLink: true,
          disposition: 1,
          displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
          displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
          sight: {
            enabled: vision,
          },
          detectionModes: [
            {
              id: "basicSight",
              range: 30,
              enabled: true,
            },
          ],
        },
        data.prototypeToken || {},
      );
    } else if (data.type === "npc") {
      if (typeof data.img === "undefined") {
        data.img = "systems/Pendragon/assets/Icons/default_actor_dark.webp";
      }
      data.prototypeToken = foundry.utils.mergeObject(
        {
          actorLink: false,
          disposition: 0,
          displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
          displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
          sight: {
            enabled: vision,
          },
          bar1: {
            attribute: "hp",
          },
          bar2: {
            attribute: "woundTotal",
          },
          detectionModes: [
            {
              id: "basicSight",
              range: 30,
              enabled: true,
            },
          ],
        },
        data.prototypeToken || {},
      );
    } else if (data.type === "follower") {
      if (typeof data.img === "undefined") {
        data.img = "systems/Pendragon/assets/Icons/default_actor_dark.webp";
      }
      data.prototypeToken = foundry.utils.mergeObject(
        {
          actorLink: true,
          disposition: 1,
          displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
          displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
          sight: {
            enabled: vision,
          },
          bar1: {
            attribute: "hp",
          },
          bar2: {
            attribute: "woundTotal",
          },
          detectionModes: [
            {
              id: "basicSight",
              range: 30,
              enabled: true,
            },
          ],
        },
        data.prototypeToken || {},
      );
    } else if (data.type === "party") {
      data.prototypeToken = foundry.utils.mergeObject({
        actorLink: true,
        detectionModes: [
          {
            enabled: false,
          },
        ],
      });
      data.ownership = foundry.utils.mergeObject({
        default: 2,
      });
    } else if (data.type === "encounter") {
      data.img = "systems/Pendragon/assets/Icons/rally-the-troops.svg";
      data.prototypeToken = foundry.utils.mergeObject({
        actorLink: true,
        detectionModes: [
          {
            enabled: false,
          },
        ],
      });
    } else if (data.type === "battle") {
      data.img = "systems/Pendragon/assets/Icons/swords-emblem.svg";
      data.prototypeToken = foundry.utils.mergeObject({
        actorLink: true,
        detectionModes: [
          {
            enabled: false,
          },
        ],
      });
    } else if (data.type === "manor") {
      data.img = "systems/Pendragon/assets/Icons/stone-tower.svg";
      data.prototypeToken = foundry.utils.mergeObject({
        actorLink: true,
        detectionModes: [
          {
            enabled: false,
          },
        ],
      });
    } else if (data.type === "barony") {
      data.img = "systems/Pendragon/assets/Icons/medieval-gate.svg";
      data.prototypeToken = foundry.utils.mergeObject({
        actorLink: true,
        detectionModes: [
          {
            enabled: false,
          },
        ],
      });
    }

    let actor = await super.create(data, options);

    if (data.type === "character") {
      //If an actor now add all skills to the sheet
      //Get list of skills and add to actor
      let newItems = [];
      let skillList = await game.system.api.pid.fromPIDRegexBest({
        pidRegExp: /^i.skill\./,
        type: "i",
      });
      let knightSkillList = await skillList.filter((itm) => itm.system.starter);
      for (let itm of knightSkillList) {
        let existing = actor.items.filter(
          (citm) => citm.flags?.Pendragon?.pidFlag?.id === itm.flags?.Pendragon?.pidFlag?.id,
        );
        if (existing.length < 1) {
          newItems.push(itm);
        }
      }

      //Get list of traits and add to actor
      let traitList = await game.system.api.pid.fromPIDRegexBest({
        pidRegExp: /^i.trait\./,
        type: "i",
      });
      for (let itm of traitList) {
        let existing = actor.items.filter(
          (citm) => citm.flags?.Pendragon?.pidFlag?.id === itm.flags?.Pendragon?.pidFlag?.id,
        );
        if (existing.length < 1) {
          newItems.push(itm);
        }
      }

      //Get list of passions and add to actor
      let passionList = await game.system.api.pid.fromPIDRegexBest({
        pidRegExp: /^i.passion\./,
        type: "i",
      });
      for (let itm of passionList) {
        let existing = actor.items.filter(
          (citm) => citm.flags?.Pendragon?.pidFlag?.id === itm.flags?.Pendragon?.pidFlag?.id,
        );
        if (existing.length < 1) {
          newItems.push(itm);
        }
      }

      await actor.createEmbeddedDocuments("Item", newItems);
    } else if (data.type === "manor") {
      //If a manor now add all starter Improvements to the sheet
      let newItems = [];
      let impList = await game.system.api.pid.fromPIDRegexBest({
        pidRegExp: /^i.manorImp\./,
        type: "i",
      });
      let starterImpList = await impList.filter((itm) => itm.system.starter);
      for (let itm of starterImpList) {
        let nItm = itm.toObject();
        nItm.system.paid.libra = nItm.system.cost.libra;
        nItm.system.paid.denarii = nItm.system.cost.denarii;
        let existing = actor.items.filter(
          (citm) => citm.flags?.Pendragon?.pidFlag?.id === nItm.flags?.Pendragon?.pidFlag?.id,
        );
        if (existing.length < 1) {
          newItems.push(nItm);
        }
      }
      await actor.createEmbeddedDocuments("Item", newItems);
    } else if (data.type === "barony") {
      //If a manor now add all starter people to the sheet
      let newItems = [];
      let impList = await game.system.api.pid.fromPIDRegexBest({
        pidRegExp: /^i.background\./,
        type: "i",
      });
      let starterImpList = await impList.filter((itm) => itm.system.starting);
      for (let itm of starterImpList) {
        let nItm = itm.toObject();
        nItm.system.annualCost.libra = 0;
        nItm.system.annualCost.denarii = 0;
        let existing = actor.items.filter(
          (citm) => citm.flags?.Pendragon?.pidFlag?.id === nItm.flags?.Pendragon?.pidFlag?.id,
        );
        if (existing.length < 1) {
          newItems.push(nItm);
        }
      }
      let backgroundItems = await actor.createEmbeddedDocuments("Item", newItems);
      for (let newItm of backgroundItems) {
        await PENactorItemDrop._addBackgroundSkill(actor, newItm);
      }
    }

    return actor;
  }

  //get the current horse, if any
  currentHorse() {
    const currentHorse = this.getFlag("Pendragon", "currentHorse");
    if (currentHorse) {
      return this.items.find((i) => i.id === currentHorse);
    }
    return null;
  }

  //get the current weapon, if any
  currentWeapon() {
    const currentWeapon = this.getFlag("Pendragon", "currentWeapon");
    if (currentWeapon) {
      const item = this.items.get(currentWeapon);
      //only weapons can be the current weapon
      return item?.type === "weapon" ? item : null;
    }
    return null;
  }

  //the item ID held in each hand is stored in system.equippedHands
  getItemInHand(hand) {
    const id = this.system.equippedHands?.[hand];
    return id ? (this.items.get(id) ?? null) : null;
  }
  getPrimaryHandItem() {
    return this.getItemInHand("primary");
  }
  getSecondaryHandItem() {
    return this.getItemInHand("secondary");
  }
  //a two-handed weapon occupies both hands (same item ID in each)
  isWieldingTwoHanded() {
    const hands = this.system.equippedHands ?? {};
    return Boolean(hands.primary && hands.primary === hands.secondary);
  }
  getTwoHandedWeapon() {
    if (!this.isWieldingTwoHanded()) return null;
    return this.items.get(this.system.equippedHands.primary) ?? null;
  }
  // armour item system.type is true for armor, false for shields
  hasShieldEquipped() {
    return this.items.some((itm) => itm.type === "armour" && itm.system.equipped && !itm.system.type);
  }
  //shields occupy the secondary hand; a lance wielded two-handed may still keep a shield equipped (couched charge only)
  async setShieldHand(shield, equipped) {
    if (!this.system.equippedHands) return;
    const hands = {
      primary: this.system.equippedHands.primary ?? "",
      secondary: this.system.equippedHands.secondary ?? "",
    };
    if (!equipped) {
      if (hands.secondary === shield.id) hands.secondary = "";
      await this.update({ "system.equippedHands.secondary": hands.secondary });
      await this.syncCurrentWeapon(hands);
      return;
    }
    if (this.isWieldingTwoHanded()) {
      const wielded = this.getTwoHandedWeapon();
      if (wielded?.system?.skill === "charge") {
        //the shield stays equipped but the couched lance keeps the secondary hand; only usable while charging
        ui.notifications.warn(game.i18n.localize("PEN.warn.shieldWithCouchedLance"));
        return;
      }
      ui.notifications.warn(game.i18n.localize("PEN.warn.twoHandedOccupiesBoth"));
      //unequip again; there are no free hands
      await shield.update({ "system.equipped": false });
      return;
    }
    if (hands.secondary && hands.secondary !== shield.id) {
      const displaced = this.items.get(hands.secondary);
      ui.notifications.warn(game.i18n.format("PEN.warn.displacedFromHand", { item: displaced?.name ?? "" }));
      //anything displaced from a hand is dropped
      if (displaced?.type === "weapon") {
        await displaced.update({ "system.wield": "dropped" });
        await this.#mergeStacks("dropped");
      }
    }
    hands.secondary = shield.id;
    await this.update({ "system.equippedHands.secondary": hands.secondary });
    await this.syncCurrentWeapon(hands);
  }
  getShieldArmourPoints() {
    return this.system.shield ?? 0;
  }
  //the main weapon is the two-handed weapon if wielding one, else whatever weapon is in the primary hand
  getMainWeapon() {
    if (this.isWieldingTwoHanded()) return this.getTwoHandedWeapon();
    const primary = this.getPrimaryHandItem();
    return primary?.type === "weapon" ? primary : null;
  }
  canWeaponBeTwoHanded(weapon) {
    return weapon?.system?.canBeTwoHanded ?? false;
  }
  //the wield state of a weapon: carried, dropped, primaryHand or twoHanded
  //the hand slots are authoritative for anything in hand; the item's own wield field
  //records whether it is otherwise carried (sheathed/at the side) or dropped
  getWieldState(item) {
    if (!item) return "";
    const hands = this.system.equippedHands ?? {};
    const inPrimary = hands.primary === item.id;
    const inSecondary = hands.secondary === item.id;
    if (inPrimary && inSecondary) return "twoHanded";
    if (inPrimary) return "primaryHand";
    if (inSecondary) return "secondaryHand";
    if (item.type !== "weapon") return "";
    return item.system.wield === "dropped" ? "dropped" : "carried";
  }
  //display label for how an item is currently wielded; carried is the resting state
  //(sheathed or at the side) so it needs no label
  getWieldLabel(item) {
    const state = this.getWieldState(item);
    if (!state || state === "carried") return "";
    if (state === "secondaryHand") return game.i18n.localize("PEN.secondaryHand");
    const key = `PEN.wield.${state}`;
    const label = game.i18n.localize(key);
    return label === key ? "" : label;
  }
  //a two-handed grip adds +2D6 damage; returns the number of extra damage dice
  getTwoHandedBonus(weapon = this.getTwoHandedWeapon()) {
    if (!weapon) return 0;
    const hands = this.system.equippedHands ?? {};
    if (hands.primary !== weapon.id || hands.secondary !== weapon.id) return 0;
    return weapon.system?.canBeTwoHanded ? 2 : 0;
  }

  //anything displaced from a hand leaves it properly: a weapon is dropped (on the ground),
  //a shield is no longer equipped. Either could otherwise stay "active" with no hand holding it
  async displaceItem(item) {
    if (!item) return;
    ui.notifications.warn(game.i18n.format("PEN.warn.displacedFromHand", { item: item.name }));
    if (item.type === "weapon") {
      await item.update({ "system.wield": "dropped" });
      await this.#mergeStacks("dropped");
    } else if (item.type === "armour") {
      await item.update({ "system.equipped": false });
    }
  }

  //set the wield state of a weapon: carried, dropped, primaryHand or twoHanded
  //anything displaced from a hand is dropped, since dropping a weapon is always allowed
  //(picking it up again takes a combat action)
  async setWield(weapon, wield) {
    if (!this.system.equippedHands || weapon?.type !== "weapon") return false;
    //a stack can't go in a hand; a hand state draws a single unit out of it instead
    const inHand = wield === "primaryHand" || wield === "twoHanded";
    if (inHand && (weapon.system.quantity ?? 1) > 1) {
      const unit = await this.#drawUnit(weapon);
      if (!unit) return false;
      await this.#applyWield(unit, wield);
      await weapon.update({ "system.quantity": weapon.system.quantity - 1 });
      return true;
    }
    return this.#applyWield(weapon, wield);
  }

  //a drawn unit is a copy of the stack with quantity 1
  async #drawUnit(weapon) {
    const unitData = weapon.toObject();
    delete unitData._id;
    unitData.system.quantity = 1;
    const [unit] = await this.createEmbeddedDocuments("Item", [unitData]);
    return unit ?? null;
  }

  //the hand-assignment core; weapons passed here always have quantity 1
  async #applyWield(weapon, wield) {
    const hands = {
      primary: this.system.equippedHands.primary ?? "",
      secondary: this.system.equippedHands.secondary ?? "",
    };
    //clear this weapon from any hand it already occupies
    if (hands.primary === weapon.id) hands.primary = "";
    if (hands.secondary === weapon.id) hands.secondary = "";
    //take the hands the new state needs, displacing whatever was there
    const displaced = [];
    const displace = (id) => {
      if (id && id !== weapon.id && !displaced.includes(id)) displaced.push(id);
    };
    if (wield === "primaryHand") {
      displace(hands.primary);
      //a two-handed occupant holds both hands, so taking the primary must free the secondary too
      //(a shield in the secondary hand is left alone)
      if (hands.primary && hands.primary === hands.secondary) hands.secondary = "";
      hands.primary = weapon.id;
    } else if (wield === "twoHanded") {
      displace(hands.primary);
      displace(hands.secondary);
      hands.primary = weapon.id;
      hands.secondary = weapon.id;
    }
    await weapon.update({ "system.wield": wield });
    await this.update({
      "system.equippedHands.primary": hands.primary,
      "system.equippedHands.secondary": hands.secondary,
    });
    for (const id of displaced) await this.displaceItem(this.items.get(id));
    //keep the currentWeapon flag in sync with what is actually in hand
    await this.syncCurrentWeapon(hands);
    if (wield === "carried" || wield === "dropped") await this.#mergeStacks(wield);
    return true;
  }

  //merge identical weapons that share the same no-hand state (carried or dropped)
  //back into a single stack; hand states never merge
  async #mergeStacks(state) {
    const groups = {};
    for (const item of this.items) {
      if (item.type !== "weapon" || this.getWieldState(item) !== state) continue;
      //identity = name + everything except quantity and wield state
      const { quantity, wield, ...rest } = item.system;
      const key = JSON.stringify([item.name, rest]);
      (groups[key] ??= []).push(item);
    }
    for (const group of Object.values(groups)) {
      if (group.length < 2) continue;
      const [keep, ...absorbed] = group;
      const total = absorbed.reduce((sum, i) => sum + (i.system.quantity ?? 1), keep.system.quantity ?? 1);
      await keep.update({ "system.quantity": total });
      await this.deleteEmbeddedDocuments(
        "Item",
        absorbed.map((i) => i.id),
      );
    }
  }

  //the currentWeapon flag mirrors the weapon actually in hand (never a shield)
  async syncCurrentWeapon(hands = this.system.equippedHands ?? {}) {
    const main = this.items.get(hands.primary) ?? this.items.get(hands.secondary);
    const mainId = main?.type === "weapon" ? main.id : null;
    if (mainId !== (this.currentWeapon()?.id ?? null)) {
      await this.setFlag("Pendragon", "currentWeapon", mainId);
    }
  }

  isMounted() {
    return this.statuses.has(PendragonStatusEffects.MOUNTED);
  }

  // armour item system.type is true for armor, false for shields
  isWearingArmor() {
    return this.items.some((itm) => itm.type === "armour" && itm.system.equipped && itm.system.type);
  }

  // movement-based actions use the horse's movement rate when mounted
  getMoveRate() {
    if (this.isMounted()) {
      const horse = this.currentHorse();
      if (horse) return horse.system.move;
    }
    // NPCs may have a manual movement rate override
    if (this.type === "npc" && this.system.manMove) return this.system.manMove;
    return this.system.move ?? 0;
  }

  async mountCurrentHorse() {
    if (this.isMounted()) return;
    const horse = this.currentHorse();
    if (horse) {
      await this.update({ "system.horseDam": horse.system.damage, "system.horseChgDam": horse.system.chargeDmg });
      await this.addStatus(PendragonStatusEffects.MOUNTED);
    }
  }

  async dismountCurrentHorse() {
    if (!this.isMounted()) return;
    this.removeStatus(PendragonStatusEffects.MOUNTED);
  }

  async addStatus(statusId) {
    // if we already have the status, nothing to do
    if (this.statuses.has(statusId)) return;
    // just in case
    const existing = this.effects.getName(statusId);
    if (existing) return;
    // otherwise add the status effect
    const effect = await ActiveEffect.implementation.fromStatusEffect(statusId);
    return ActiveEffect.implementation.create(effect, { parent: this });
  }
  removeStatus(statusId) {
    const existing = this.effects.getName(statusId);
    if (existing) return existing.delete();
  }

  async addHistoryEvent(name, desc, glory = 0) {
    const itemData = {
      name: name,
      type: "history",
      system: {
        libra: 0,
        denarii: 0,
        description: desc,
        year: game.time.components.year,
        glory: glory,
      },
    };
    let newHist = await Item.create(itemData, { parent: this });
    // do history event really need a PID?
    let key = await game.system.api.pid.guessId(newHist);
    await newHist.update({
      "flags.Pendragon.pidFlag.id": key,
      "flags.Pendragon.pidFlag.lang": game.i18n.lang,
      "flags.Pendragon.pidFlag.priority": 0,
    });
  }

  //Rerender Party Sheet if actor is in it
  async _updateParty(actorData) {
    try {
      const parties = game.actors.filter(
        (actr) =>
          actr.type === "party" && actr.sheet.rendered && actr.system.members.find((m) => m.uuid === actorData.uuid),
      );
      for (const party of parties) {
        await party.render();
      }
    } catch (e) {
      // Called before sheet is ready
    }
  }

  //Rerender Battle Sheet if actor is in it
  async _updateBattle(actorData) {
    try {
      const parties = game.actors.filter(
        (actr) =>
          actr.type === "battle" &&
          actr.sheet.rendered &&
          actr.system.encounters.find((m) => m.uuid === actorData.uuid),
      );
      for (const party of parties) {
        await party.render();
      }
    } catch (e) {
      // Called before sheet is ready
    }
  }

  getSkillTotal(pid) {
    const skill = this.items.find((citm) => citm.flags?.Pendragon?.pidFlag?.id === pid);
    if (skill && skill.type == "skill") {
      return skill.system.total;
    }
  }
  getItemByPid(pid) {
    return this.items.find((citm) => citm.flags?.Pendragon?.pidFlag?.id === pid);
  }
  //Used for Rolling NPCs when token dropped
  get hasRollableCharacteristics() {
    for (const [, value] of Object.entries(this.system.stats)) {
      if (value.formula === "") {
        continue;
      }
      if (isNaN(Number(value.formula))) return true;
    }
    if (this.system.random) {
      for (let itm of this.system.random) {
        if (itm.value === "") {
          continue;
        }
        if (isNaN(Number(itm.value))) return true;
      }
    }
    return false;
  }

  //Make Selection on dropping a token
  static async dropChoice(document, options) {
    let choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("PEN.TokenCreationRoll.Title") },
      content: game.i18n.localize("PEN.TokenCreationRoll.Prompt"),
      buttons: [
        {
          label: game.i18n.localize("PEN.TokenCreationRoll.ButtonRoll"),
          action: "roll",
          callback: async () => {
            await document._object.actor.rollCharacteristicsValue();
            ui.notifications.info(
              game.i18n.format("PEN.TokenCreationRoll.Rolled", {
                name: document.object.actor.name,
              }),
            );
            document._object.actor.lock = true;
          },
        },
        {
          label: game.i18n.localize("PEN.TokenCreationRoll.ButtonSkip"),
          action: "skip",
        },
      ],
    });
  }

  //Roll Random Stats
  async rollCharacteristicsValue() {
    if (this.type !== "npc") {
      return;
    }
    const abilities = {};
    const changes = [];

    //Check Stats
    for (const [key, value] of Object.entries(this.system.stats)) {
      if (value.formula && !value.formula.startsWith("@")) {
        const r = new Roll(value.formula);
        await r.evaluate();
        if (r.total) {
          abilities[`system.stats.${key}.value`] = Math.floor(r.total);
        }
      }
    }
    await this.update(abilities);

    //Check random traits, skills, passions
    for (let random of this.system.random) {
      for (let item of this.items) {
        if (item.flags.Pendragon?.pidFlag?.id === random.pid) {
          if (random.value && !random.value.startsWith("@")) {
            const r = await new Roll(random.value);
            await r.evaluate();
            if (r.total) {
              changes.push({
                _id: item.id,
                "system.value": Math.floor(r.total),
              });
            }
          }
        }
      }
    }
    await Item.updateDocuments(changes, { parent: this });

    await this.update({
      "system.manMove": this.system.move,
      "system.manArm": this.system.armour,
      "system.manShd": this.system.shield,
      "system.manKnockdown": this.system.hp.knockdown,
      "system.manMjrWnd": this.system.hp.majorWnd,
      "system.manDmg": this.system.damage,
      "system.manHealRate": this.system.healRate,
      "system.manMaxHP": 0,
      "system.manUnconscious": 0,
    });
  }

  //Calculate Defensive values
  _calcDV(actorData) {
    actorData.dvLabel = "";
    actorData.dvLabelHint = "";
    let citywallsLabel = "";
    let outworksLabel = "";
    let outerbaileyLabel = "";
    let innerbaileyLabel = "";
    let motteLabel = "";
    let strongholdLabel = "";
    let tempLabel = "";
    let tempLabelHint = "";

    let activeManorImp = actorData.items
      .filter((i) => i.type === "manorImp")
      .filter((i) => ["maintained", "unmaintained"].includes(i.system.status));
    //Calculate Defense Value
    for (let [key, dv] of Object.entries(actorData.system.dv)) {
      dv.label = game.i18n.localize(`PEN.dv.${key}`);
      dv.value = activeManorImp
        .filter((i) => i.system.dv.value != 0 && i.system.dv.pos === key)
        .map((i) => i.system.dv.value)
        .reduce((total, current) => total + current, 0);
      if (["motte1", "motte2", "motte3"].includes(key)) {
        let motte = activeManorImp
          .filter((i) => i.system.dv.value != 0 && i.system.dv.pos === key)
          .filter((i) => i.flags?.Pendragon?.pidFlag?.id === "i.manorImp.motte");
        if (motte.length < 1) {
          dv.singlemotte = false;
        }
      }
    }
    //If Motte 1,2 or 3 have scores above 0 and are only single mottes then add the relevant stronghold score
    if (actorData.system.dv.motte1.value > 0 && actorData.system.dv.motte1.singlemotte) {
      actorData.system.dv.motte1.value = actorData.system.dv.motte1.value + actorData.system.dv.stronghold1.value;
    }
    if (actorData.system.dv.motte2.value > 0 && actorData.system.dv.motte2.singlemotte) {
      actorData.system.dv.motte2.value = actorData.system.dv.motte2.value + actorData.system.dv.stronghold2.value;
    }
    if (actorData.system.dv.motte3.value > 0 && actorData.system.dv.motte3.singlemotte) {
      actorData.system.dv.motte3.value = actorData.system.dv.motte3.value + actorData.system.dv.stronghold3.value;
    }

    for (let [key, dv] of Object.entries(actorData.system.dv)) {
      if (dv.value != 0) {
        let tempCase = key.slice(0, -1);
        switch (tempCase) {
          case "citywall":
            citywallsLabel = dv.value;
            break;
          case "outwork":
            outworksLabel = dv.value;
            break;
          case "outerbailey":
            outerbaileyLabel = outerbaileyLabel + dv.value + "-";
            break;
          case "innerbailey":
            innerbaileyLabel = innerbaileyLabel + dv.value + "-";
            break;
          case "motte":
            motteLabel = motteLabel + dv.value + "-";
            break;
          case "stronghold":
            strongholdLabel = strongholdLabel + dv.value + "-";
            break;
        }
      }
    }

    if (citywallsLabel != "") {
      tempLabel = tempLabel + citywallsLabel + "/";
      tempLabelHint = tempLabelHint + "<p>" + game.i18n.localize("PEN.dv.citywalls") + ": " + citywallsLabel + "</p>";
    }
    if (outworksLabel != "") {
      tempLabel = tempLabel + outworksLabel + "/";
      tempLabelHint = tempLabelHint + "<p>" + game.i18n.localize("PEN.dv.outworks") + ": " + outworksLabel + "</p>";
    }
    if (outerbaileyLabel.length > 0) {
      tempLabel = tempLabel + outerbaileyLabel.slice(0, -1) + "/";
      tempLabelHint =
        tempLabelHint +
        "<p>" +
        game.i18n.localize("PEN.dv.outerbailey") +
        ": " +
        outerbaileyLabel.slice(0, -1) +
        "</p>";
    }
    if (innerbaileyLabel.length > 0) {
      tempLabel = tempLabel + innerbaileyLabel.slice(0, -1) + "/";
      tempLabelHint =
        tempLabelHint +
        "<p>" +
        game.i18n.localize("PEN.dv.innerbailey") +
        ": " +
        innerbaileyLabel.slice(0, -1) +
        "</p>";
    }
    if (motteLabel.length > 0) {
      tempLabel = tempLabel + motteLabel.slice(0, -1) + "/";
      tempLabelHint =
        tempLabelHint + "<p>" + game.i18n.localize("PEN.dv.motte") + ": " + motteLabel.slice(0, -1) + "</p>";
    }
    if (strongholdLabel.length > 0) {
      tempLabel = tempLabel + strongholdLabel.slice(0, -1) + "/";
      tempLabelHint =
        tempLabelHint + "<p>" + game.i18n.localize("PEN.dv.stronghold") + ": " + strongholdLabel.slice(0, -1) + "</p>";
    }

    actorData.dvLabel = tempLabel.slice(0, -1);
    actorData.dvLabelHint = tempLabelHint;

    if (actorData.dvLabel === "") {
      actorData.dvLabel = 0;
      actorData.dvLabelHint = game.i18n.localize("PEN.none");
    }
    return;
  }

  //Calculate Folk Costs
  _calcFolkCost(actorData) {
    //Calculate Skill Totals
    for (let i of actorData.items) {
      if (i.type === "skill") {
        i.system.total =
          Number(i.system.value) +
          Number(i.system.culture) +
          Number(i.system.family) +
          Number(i.system.create) +
          Number(i.system.winter);
      }
    }
    //Calculate Skill Cost
    let backList = actorData.items.filter((i) => i.type === "background");
    let skillList = actorData.items.filter((i) => i.type === "skill").filter((i) => i.system.npcSource != "");
    for (let backNPC of backList) {
      //Skill Cost is based on the highest skill associated with the background npc
      let theseSkills = skillList
        .filter((i) => i.system.npcSource === backNPC.uuid)
        .map((s) => {
          return { name: s.name, total: s.system.total };
        });
      let maxSkill = Math.max(...theseSkills.map((s) => s.total));
      backNPC.system.skillCost.libra = Math.max(0, maxSkill - 15) + Math.max(0, maxSkill - 19);
      //Calculate Total Cost
      let totalCost =
        backNPC.system.annualCost.libra * 240 +
        backNPC.system.skillCost.libra * 240 +
        backNPC.system.annualCost.denarii +
        backNPC.system.skillCost.denarii;
      backNPC.system.totalCost.libra = Math.floor(totalCost / 240);
      backNPC.system.totalCost.denarii = totalCost % 240;
    }
    //Calculate Total Folk Cost
    let folkCost = 0;
    let manorFolk = actorData.items.filter((i) => i.type === "background");
    for (let folk of manorFolk) {
      folkCost = folkCost + folk.system.totalCost.libra * 240 + folk.system.totalCost.denarii;
    }
    if (actorData.type === "manor") {
      actorData.system.folkCost.libra = Math.floor(folkCost / 240);
      actorData.system.folkCost.denarii = folkCost % 240;
    } else {
      actorData.system.folkCost.libra = Math.round(folkCost / 240);
      actorData.system.folkCost.denarii = 0;
    }
    return;
  }
}
