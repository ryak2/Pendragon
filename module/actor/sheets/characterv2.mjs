import { PENCombat } from "../../apps/combat.mjs";
import { PENWinter } from "../../apps/winterPhase.mjs";
import { PENCharCreate } from "../../apps/charCreate.mjs";
import { PENactorItemDrop } from "../actor-itemDrop.mjs";
import { PENSelectLists } from "../../apps/select-lists.mjs";
import { PENUtilities } from "../../apps/utilities.mjs";
import { isCtrlKey } from "../../apps/helper.mjs";
import { PendragonActorSheet } from "./actor-sheet.mjs";
import { WoundTrackerDialog } from "./actor-wound-tracker.mjs";
import { CardType, PENCheck, RollType } from "../../apps/checks.mjs";
import { CombatAction } from "../../apps/combat-actions.mjs";

const { api, ux } = foundry.applications;

export class PendragonCharacterSheetv2 extends PendragonActorSheet {
  constructor(options = {}) {
    super(options);
  }

  static DEFAULT_OPTIONS = {
    classes: ["Pendragon", "sheet", "actor", "character2"],
    position: {
      width: 900,
      height: 1000,
    },
    tag: "form",
    // automatically updates the item
    form: {
      submitOnChange: true,
    },
    actions: {
      onEditImage: this._onEditImage,
      editPid: this._onEditPid,
      rollStat: this._onRollStat,
      rollTrait: this._onRollTrait,
      rollDecision: this._onRollDecision,
      rollPassion: this._onRollPassion,
      rollSkill: this._onRollSkill,
      rollGlory: this._onRollGlory,
      showWounds: this._onShowWounds,
      toggleXP: this._onToggleXP,
      toggleOpposingXP: this._onToggleOpposingXP,
      addEffect: this.#onCreateActiveEffect,
      editEffect: this.#onEditActiveEffect,
      removeEffect: this.#onDeleteActiveEffect,
      addItem: this.#onCreateItem,
      editItem: this.#onEditItem,
      toggleEquip: this._onToggleEquip,
      dropHand: this._onDropHand,
      switchHorse: this._onSwitchHorse,
      goToEquipment: this._onGoToEquipment,
      switchSheet: this._onSwitchSheet,
      // automated combat actions
      combatAction: this._declareCombatAction,
      toggleCondition: this.#toggleCondition,
    },
    window: {
      resizable: true,
    },
  };

  static PARTS = {
    header: {
      template: "systems/Pendragon/templates/actor/character/header.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    // each tab gets its own template
    combat: {
      template: "systems/Pendragon/templates/actor/character/combat.hbs",
    },
    traits: {
      template: "systems/Pendragon/templates/actor/character/traits.hbs",
    },
    passions: {
      template: "systems/Pendragon/templates/actor/character/passions.hbs",
    },
    skills: {
      template: "systems/Pendragon/templates/actor/character/skills.hbs",
    },
    equipment: {
      template: "systems/Pendragon/templates/actor/character/equipment.hbs",
    },
    stable: {
      template: "systems/Pendragon/templates/actor/character/stable.hbs",
    },
    events: {
      template: "systems/Pendragon/templates/actor/character/events.hbs",
    },
    house: {
      template: "systems/Pendragon/templates/actor/character/family.hbs",
    },
    biography: {
      template: "systems/Pendragon/templates/actor/character/bio.hbs",
    },
    effects: {
      template: "systems/Pendragon/templates/actor/character/effects.hbs",
    },
  };
  static TABS = {
    primary: {
      tabs: [
        { id: "combat" },
        { id: "traits" },
        { id: "passions" },
        { id: "skills" },
        { id: "equipment" },
        { id: "stable" },
        { id: "events" },
        { id: "house" },
        { id: "biography" },
        { id: "effects" },
      ],
      labelPrefix: "PEN",
      initial: "combat",
    },
  };

  async _preparePartContext(partId, context) {
    switch (partId) {
      case "equipment":
      case "events":
      case "house":
        context.tab = context.tabs[partId];
        break;
      case "stable":
        return this._prepareStableTab(context);
      case "combat":
        return this._prepareCombatTab(context);
      case "skills":
        return this._prepareSkillsTab(context);
      case "biography":
        return this._prepareBioTab(context);
      case "passions":
        return this._preparePassionsTab(context);
      case "traits":
        return this._prepareTraitTab(context);
      case "effects":
        return this._prepareEffects(context);
      default:
    }
    return context;
  }

  async _prepareContext(options) {
    // Default tab for first time it's rendered this session
    if (!this.tabGroups.primary) this.tabGroups.primary = "combat";
    // if we had a base class, do this then mergeObject
    // let sheetData = await super._prepareContext(options);
    const sheetData = {
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      actor: this.actor,
      system: this.actor.system,
      flags: this.actor.flags,
      hasOwner: this.actor.isEmbedded === true,
      isGM: game.user.isGM,
      fields: this.document.schema.fields,
      // will not move to base class
      isLocked: this.actor.system.lock,
      isWinter: game.settings.get("Pendragon", "winter"),
      isDevelopment: game.settings.get("Pendragon", "development"),
      isCreation: game.settings.get("Pendragon", "creation"),
      useRelation: game.settings.get("Pendragon", "useRelation"),
      items: this.actor.items,
      tabs: this._prepareTabs("primary"),
      manualGlory: game.settings.get("Pendragon", "manualGlory"),
      trackWnd: game.settings.get("Pendragon", "trackWnd"),
      solLabel: game.i18n.localize("PEN." + this.actor.system.sol),
    };
    // now organize the items belonging to the character
    await this._prepareItems(sheetData);
    return sheetData;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  async _prepareItems(context) {
    // Initialize containers.
    const gears = [];
    const traits = [];
    const wounds = [];
    const history = [];
    const horses = [];
    const squires = [];
    const armours = [];
    const weapons = [];
    const families = [];
    const ideals = [];
    const household = [];
    const followers = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      if (i.type === "gear") {
        i.system.cleanDesc = i.system.description.replace(/<[^>]+>/g, "");
        gears.push(i);
      } else if (i.type === "trait") {
        traits.push(i);
      } else if (i.type === "wound" && i.system.value > 0) {
        wounds.push(i);
      } else if (i.type === "history") {
        if (i.system.favour) {
          i.system.label = game.i18n.localize("PEN.favourShort") + i.system.favourLevel + " " + i.system.description;
        } else {
          i.system.label = i.system.description;
        }
        i.system.label = i.system.label.replace(/(<([^>]+)>)/gi, "");
        i.system.glory = Number(i.system.glory) || 0;
        history.push(i);
      } else if (i.type === "horse") {
        i.system.careName = game.i18n.localize("PEN.horseHealth." + i.system.horseCare);
        i.system.healthName = game.i18n.localize("PEN.horseHealth." + i.system.horseHealth);
        i.system.totalAR = i.system.armour + i.system.horseArmour;
        i.system.label = i.name;
        if (i.system.horseName != "") {
          i.system.label = i.system.horseName;
        }
        horses.push(i);
      } else if (i.type === "squire") {
        i.system.squireType = game.i18n.localize("PEN." + i.system.category);
        if (i.system.category === "squire") {
          squires.push(i);
        } else {
          household.push(i);
        }
      } else if (i.type === "armour") {
        i.materialLabel = game.i18n.localize("PEN." + i.system.material);
        armours.push(i);
      } else if (i.type === "weapon") {
        i.mountedLabel = game.i18n.localize("PEN." + i.system.mounted);
        i.wieldState = this.actor.getWieldState(i);
        i.wieldType = PENSelectLists.getWieldTypes(i.system);
        i.wieldLabel = this.actor.getWieldLabel(i);
        weapons.push(i);
      } else if (i.type === "family") {
        i.system.typeName = game.i18n.localize("PEN." + i.system.relation);
        families.push(i);
      } else if (i.type === "ideal") {
        ideals.push(i);
      } else if (i.type === "relationship") {
        i.system.typeName = game.i18n.localize("PEN." + i.system.typeLabel);
        if (i.system.born > 0) {
          i.system.age = game.time.components.year - i.system.born;
        } else {
          i.system.age = "";
        }
        followers.push(i);
      }
    }

    // Sort Gears
    gears.sort((a, b) => a.name.localeCompare(b.name));

    // Sort Traits
    traits.sort((a, b) => a.name.localeCompare(b.name));

    // Sort History in reverse chronological order
    history.sort((a, b) => b.system.year - a.system.year || b._stats.createdTime - a._stats.createdTime);

    // Sort Horses with Warhorse at top
    horses.sort((a, b) => a.system.chargeDmg - b.system.chargeDmg);

    // Sort Squires by age
    squires.sort((a, b) => a.system.age - b.system.age);

    // Sort Wounds by damage, low first
    wounds.sort((a, b) => a.system.value - b.system.value);

    // Sort Weapons by melee/missile and name
    weapons.sort((a, b) => a.system.melee - b.system.melee || a.name.localeCompare(b.name));

    // Sort Ideals
    ideals.sort((a, b) => a.name.localeCompare(b.name));

    // Used wherever we need to show a particular status
    // The effects tab renders the full list of conditions slightly differently
    context.statuses = CONFIG.statusEffects
      .map((c) => {
        const hasCondition = this.actor.statuses.has(c.id);
        return {
          id: c.id,
          name: game.i18n.localize(`PEN.${c.name}`),
          img: c.img,
          active: hasCondition,
        };
      })
      .reduce((acc, o, index) => {
        acc[o.id] = o;
        return acc;
      }, {});
    // Assign and return
    context.gears = gears;
    context.traits = traits;
    context.wounds = wounds;
    context.history = history;
    context.horses = horses;
    context.armours = armours;
    context.weapons = weapons;
    context.ideals = ideals;
    context.household = household;
    context.followers = followers;
    // equipped items by hand
    context.primaryHandItem = this.actor.getPrimaryHandItem();
    context.secondaryHandItem = this.actor.getSecondaryHandItem();
    context.house = await this.prepareHousehold(families, followers, squires);
  }

  // rebuild family and station
  // this will eventually become a migration script
  async prepareHousehold(families, followers, squires) {
    const familyv2 = { parents: [], spouses: [], children: [], others: [] };
    const station = { lords: [], vassals: [], squires: [], retainers: [] };
    for (const f of families) {
      const person = {
        name: f.name,
        died: Number(f.system.died ?? 0),
        born: Number(f.system.born ?? 0),
        age: f.system.died > 0 ? f.system.died - f.system.born : game.time.components.year - f.system.born,
        glory: Number(f.system.glory),
        type: "storyNPC",
      };

      switch (f.system.relation) {
        case "parent":
          familyv2.parents.push(person);
          break;
        case "child":
          familyv2.children.push(person);
          break;
        case "spouse":
          familyv2.spouses.push(person);
          break;
        default:
          familyv2.others.push(person);
          break;
      }
    }
    for (const s of squires) {
      // why do we store age instead of born?
      s.system.born = game.time.components.year - s.system.age;
      const person = {
        name: s.name,
        died: Number(s.system.died ?? 0),
        born: Number(s.system.born ?? 0),
        age: s.system.died > 0 ? s.system.died - s.system.born : game.time.components.year - s.system.born,
        glory: Number(s.system.glory),
        type: "storyNPC",
      };
      station.squires.push(person);
    }
    for (const f of followers) {
      const otherActor = await fromUuid(f.system.sourceUuid);
      const person = {
        name: otherActor.name,
        died: Number(f.system.died ?? 0),
        born: Number(f.system.born ?? 0),
        age: f.system.died > 0 ? f.system.died - f.system.born : game.time.components.year - f.system.born,
        glory: Number(otherActor.system.glory ?? 0),
        type: f.system.typeLabel,
        uuid: f.system.sourceUuid,
      };

      switch (f.system.connection) {
        case "parent":
        case "Mother":
        case "Father":
          familyv2.parents.push(person);
          break;
        case "child":
          familyv2.children.push(person);
          break;
        case "spouse":
        case "Spouse":
          familyv2.spouses.push(person);
          break;
        default:
          familyv2.others.push(person);
          break;
      }
    }
    return { family: familyv2, station: station };
  }

  async _prepareEffects(context) {
    context.tab = context.tabs.effects;
    const effectList = await this.actor.allApplicableEffects();
    const conditionIds = CONFIG.statusEffects.map((c) => c.id);
    const effects = [];
    for (const e of effectList) {
      // TODO: should be based on id, not name, may be some leftover
      // migration shenanigans...
      if (!conditionIds.includes(e.name)) effects.push(e);
    }
    context.effects = effects;
    context.conditions = CONFIG.statusEffects
      .map((c) => {
        // check to see if the status effect has been applied to the actor
        const hasCondition = this.actor.statuses.has(c.id);
        return {
          id: c.id,
          name: game.i18n.localize(`PEN.${c.name}`),
          img: c.img,
          active: hasCondition,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return context;
  }

  async _prepareTraitTab(context) {
    // trait tab has ideals which has special prep steps
    context.tab = context.tabs.traits;
    for (const i of context.ideals) {
      i.description = await ux.TextEditor.implementation.enrichHTML(i.system.description, {
        async: true,
        secrets: false,
        relativeTo: i,
      });
      i.requirements = i.system.require.map((r) => this.checkRequirement(r));
    }
    return context;
  }

  checkRequirement(rItm) {
    let actItm = this.actor.items.filter((itm) => itm.flags.Pendragon?.pidFlag?.id === rItm.pid)[0];
    if (!actItm) {
      return {
        name: rItm.name,
        score: rItm.score,
        active: false,
      };
    }
    if (rItm.score < 0) {
      return {
        name: actItm.system.oppName,
        score: -rItm.score,
        active: actItm.system.total <= 20 + rItm.score,
      };
    } else {
      return {
        name: actItm.name,
        score: rItm.score,
        active: actItm.system.total >= rItm.score,
      };
    }
  }

  async _prepareStableTab(context) {
    context.tab = context.tabs.stable;
    const horse = this.actor.currentHorse();
    context.currentHorse = { _id: horse?._id };
    return context;
  }

  async _prepareSkillsTab(context) {
    context.tab = context.tabs.skills;
    const skills = context.items
      .filter((i) => i.type == "skill")
      .map((s) => ({
        _id: s._id,
        name: s.name,
        critical: s.system.total - 20,
        system: s.system,
        flags: s.flags,
      }));
    skills.sort((a, b) => a.system.combat - b.system.combat || a.name.localeCompare(b.name));
    context.skills = skills;
    return context;
  }

  async _preparePassionsTab(context) {
    context.tab = context.tabs.passions;
    const passions = context.items
      .filter((i) => i.type == "passion")
      .map((p) => ({
        _id: p._id,
        name: p.name,
        critical: p.system.total - 20,
        system: p.system,
        flags: p.flags,
      }));
    passions.sort((a, b) => a.system.court.localeCompare(b.system.court) || a.name.localeCompare(b.name));
    const courts = Object.groupBy(passions, (i) => i.system.court);
    for (const [k, v] of Object.entries(courts)) {
      courts[k] = { name: game.i18n.localize(`PEN.${k}`), items: v };
    }
    context.courts = courts;
    return context;
  }

  async _prepareBioTab(context) {
    context.tab = context.tabs.biography;
    context.enrichedBackgroundValue = await ux.TextEditor.implementation.enrichHTML(this.actor.system.background, {
      async: true,
      secrets: context.editable,
      relativeTo: this.actor,
    });

    context.age =
      this.actor.system.died > 0
        ? this.actor.system.died - this.actor.system.born
        : game.time.components.year - this.actor.system.born;
    return context;
  }

  /* -------------------------------------------- */
  // Activate event listeners using the prepared sheet HTML
  _onRender(context, _options) {
    super._onRender(context, _options);
    //a select needs a change listener (actions fire on click, before the value changes)
    this.element.querySelectorAll(".wield-select").forEach((n) =>
      n.addEventListener("change", (event) => {
        PendragonCharacterSheetv2._onWieldChange.call(this, event, event.currentTarget);
      }),
    );
  }

  async _prepareCombatTab(context) {
    context.tab = context.tabs.combat;
    const horse = this.actor.currentHorse();
    if (horse) {
      const name = horse.getName();
      const classification = horse.name;
      context.currentHorse = { name, system: horse.system, classification };
    }
    const weapon = this.actor.currentWeapon();
    if (weapon) {
      context.currentWeapon = {
        name: weapon.name,
        total: weapon.system.total,
        damage: weapon.system.damage,
      };
      if (weapon.system.damageChar == "h" && horse) {
        context.currentWeapon.damage = horse.system.chargeDmg;
      }
    } else {
      context.currentWeapon = this.#unarmed();
    }
    // equipped items by hand
    context.primaryHandItem = this.actor.getPrimaryHandItem();
    context.secondaryHandItem = this.actor.getSecondaryHandItem();
    // use higher of shield or parry
    // TODO: double-check we are calculating correctly
    context.shield = Math.max(this.actor.system.shield, weapon?.system.parry ?? 0);
    context.battlePosType = await PENSelectLists.getBattlePos();
    context.fieldPosType = await PENSelectLists.getFieldPos();
    return context;
  }

  #unarmed() {
    return {
      name: "Unarmed",
      total: this.actor.getSkillTotal("i.skill.brawling"),
      damage: this.actor.system.damage,
    };
  }

  static async _onToggleEquip(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    const item = this.actor.items.get(itemid);
    const equipped = !item.system.equipped;
    await item.update({ "system.equipped": equipped });
    //shields occupy the secondary hand when equipped
    if (item.type === "armour" && !item.system.type) {
      await this.actor.setShieldHand(item, equipped);
    }
  }

  static async _onToggleXP(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    const item = this.actor.items.get(itemid);
    await item.update({ "system.XP": !item.system.XP });
  }

  // used for opposing traits
  static async _onToggleOpposingXP(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    const item = this.actor.items.get(itemid);
    await item.update({ "system.oppXP": !item.system.oppXP });
  }

  static #selectCardType(event) {
    const ctrlKey = isCtrlKey(event ?? false);
    let cardType = CardType.UNOPPOSED;
    if (event.altKey) {
      cardType = CardType.OPPOSED;
    } else if (ctrlKey) {
      cardType = CardType.FIXED;
    }
    return cardType;
  }

  static #triggerRoll(rollType, event, options = {}) {
    PENCheck._trigger({
      rollType,
      cardType: PendragonCharacterSheetv2.#selectCardType(event),
      shiftKey: event.shiftKey,
      ...options,
    });
  }

  static async _onRollGlory(event, target) {
    PendragonCharacterSheetv2.#triggerRoll(RollType.GLORY, event, {
      actor: this.actor,
      token: this.token,
    });
  }
  static async _onRollStat(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    PendragonCharacterSheetv2.#triggerRoll(RollType.CHARACTERISTIC, event, {
      characteristic: itemid,
      actor: this.actor,
      token: this.token,
    });
  }
  static async _onRollTrait(event, target) {
    const { itemid, type } = target.closest("[data-itemid]")?.dataset ?? {};
    PendragonCharacterSheetv2.#triggerRoll(RollType.TRAIT, event, {
      subType: type,
      skillId: itemid,
      actor: this.actor,
      token: this.token,
    });
  }
  static async _onRollDecision(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    PENCheck._trigger({
      rollType: RollType.DECISION,
      cardType: CardType.UNOPPOSED,
      shiftKey: event.shiftKey,
      skillId: itemid,
      actor: this.actor,
      token: this.token,
    });
  }

  static async _onRollPassion(event, target) {
    const { itemid, dishonour } = target.closest("[data-itemid]")?.dataset ?? {};
    PendragonCharacterSheetv2.#triggerRoll(RollType.PASSION, event, {
      skillId: itemid,
      flatMod: Number(dishonour || 0),
      actor: this.actor,
      token: this.token,
    });
  }
  static async _onRollSkill(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    PendragonCharacterSheetv2.#triggerRoll(RollType.SKILL, event, {
      skillId: itemid,
      actor: this.actor,
      token: this.token,
    });
  }

  static async _onShowWounds(event, target) {
    const dlg = new WoundTrackerDialog(this.actor);
    dlg.render(true);
  }

  static async #toggleCondition(event, target) {
    const { effectId } = target.closest("[data-effect-id]")?.dataset ?? {};
    if (this.actor.statuses.has(effectId)) {
      this.actor.removeStatus(effectId);
    } else {
      this.actor.addStatus(effectId);
    }
  }

  static #onCreateActiveEffect(event, target) {
    const cls = foundry.utils.getDocumentClass("ActiveEffect");
    cls.createDialog({}, { parent: this.document });
  }
  static async #onEditActiveEffect(event, target) {
    const { effectId } = target.closest("[data-effect-id]")?.dataset ?? {};
    const effect = this.actor.effects.get(effectId);
    effect.sheet.render(true);
  }
  static #onDeleteActiveEffect(event, target) {
    const { effectId } = target.closest("[data-effect-id]")?.dataset ?? {};
    const effect = this.actor.effects.get(effectId);
    effect.delete();
  }
  static #onCreateItem(event, target) {
    const { itemType } = target.closest("[data-item-type]")?.dataset ?? {};
    Item.implementation.createDialog({ type: itemType }, { parent: this.document });
  }
  static async #onEditItem(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    const item = this.actor.items.get(itemid);
    item.sheet.render(true);
  }
  static async _onSwitchHorse(event, target) {
    const horses = this.actor.items.filter((itm) => itm.type === "horse");
    horses.sort((a, b) => a.system.chargeDmg - b.system.chargeDmg);
    const currentHorse = this.actor.currentHorse();
    const content = horses
      .map(
        (h) =>
          `<label><input type='radio' name='horse' value='${h.id}' ${h.id == currentHorse?.id ? "checked" : ""}>${h.getName()}</label>`,
      )
      .join("");
    const result = await api.DialogV2.wait({
      window: { title: "Select Horse" },
      content: content,
      buttons: [
        {
          label: "Switch",
          action: "switch",
          callback: (_, button) => button.form.elements.horse.value,
        },
      ],
    });
    // no result or missing horse id
    if (!result || result === "switch") return;
    await this.actor.setFlag("Pendragon", "currentHorse", result);
  }
  //wield/carry/drop a weapon from the character sheet's weapon list
  static async _onWieldChange(event, target) {
    const { itemid } = target.closest("[data-itemid]")?.dataset ?? {};
    const weapon = this.actor.items.get(itemid);
    if (weapon?.type !== "weapon") return;
    await this.actor.setWield(weapon, target.value);
  }
  static async _onGoToEquipment(event, target) {
    //ApplicationV2 tab API: changeTab(tab, group, options)
    this.changeTab("equipment", "primary");
  }
  //drop whatever is in the given hand, freeing it (dropping a weapon is always allowed)
  static async _onDropHand(event, target) {
    const { hand } = target.closest("[data-hand]")?.dataset ?? {};
    const item = this.actor.getItemInHand(hand);
    if (!item) return;
    if (item.type === "weapon") {
      await this.actor.setWield(item, "dropped");
    } else if (item.type === "armour") {
      await this.actor.setShieldHand(item, false);
      await item.update({ "system.equipped": false });
    }
  }
  static async _declareCombatAction(event, target) {
    const { combatAction } = target.closest("[data-combat-action]")?.dataset ?? {};
    // this little trick lets us map the name of the action
    // to the actual static function instead of building a pointless switch statement here
    const action = CombatAction[combatAction];
    if (action) {
      // so "mount" becomes the equivalent of "CombatAction.mount(...)"
      await action.bind(CombatAction)(this.actor, event.shiftKey);
    } else {
      console.warn(`Unknown combat action ${combatAction}`);
    }
  }

  static async _onSwitchSheet(event, target) {
    const sheetClass = this.actor.getFlag("core", "sheetClass") ?? "";
    this.actor.setFlag("core", "sheetClass", "Pendragon.PendragonCharacterSheet");
  }
}
