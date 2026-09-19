import { OPCard } from "../cards/opposed-card.mjs";
import { ChatCardState, ChatCardTemplate } from "./chat.mjs";
import { CardType, RollType, PENCheck, RollResult } from "./checks.mjs";
import { PENactorDetails } from "./actorDetails.mjs";
import { PendragonStatusEffects } from "./status-effects.mjs";

const { api, fields } = foundry.applications;

export class CombatOutcome {
  static CRITICAL = "C";
  static WIN = "W";
  static TIE = "T";
  static PARTIAL = "P";
  static LOSE = "L";
  static FUMBLE = "F";
}

export class CombatAction {
  static ATTACK = "attack";
  static UNOPPOSED_ATTACK = "unoppAtt";
  static RECKLESS = "reckless";
  static SQUIRE = "callSquire";
  static DEFEND = "defend";
  static DISARM = "disarm";
  static EVADE = "evade";
  static PRISONER = "claimPrisoner";
  static PICKUP = "pickUp";
  static SACRIFICE = "selfSacrifice";
  static STUDY = "study";
  static WITHHOLD = "withholdDamage";
  static ZIGZAG = "zigzag";
  static CHARGE = "charge";
  static CONTROL_MOUNT = "controlMount";
  static TRAMPLE = "trample";
  static DISMOUNT = "dismount";
  static QUICK_DISMOUNT = "quickDismount";
  static DODGE = "dodge";
  static ARMOR = "donArmor";
  static HOOK = "hook";
  static SET_SPEAR = "setSpear";
  static MOUNT = "mount";

  // check whether the action inflicts damage
  static canInflictDamage(action) {
    // opposed actions that don't roll damage on win:
    // defend, disarm, dodge, evade, hook, mount, pickup
    const nonDamagingActions = [
      CombatAction.DEFEND,
      CombatAction.DISARM,
      CombatAction.DISMOUNT,
      CombatAction.DODGE,
      CombatAction.EVADE,
      CombatAction.HOOK,
      CombatAction.MOUNT,
      CombatAction.PICKUP,
    ];
    if (nonDamagingActions.includes(action)) return false;
    return true;
  }

  // apply Horsemanship cap to combat rolls if mounted
  static applyHorsemanshipCap(actor, skill) {
    const targetScore = skill.total;
    // apply horsemanship cap if mounted
    if (actor.isMounted()) {
      const horsemanship = actor.getSkillTotal("i.skill.horsemanship");
      // some actors (e.g. NPCs) may not have a horsemanship skill
      if (horsemanship == null) return targetScore;
      return Math.min(targetScore, horsemanship);
    }
    return targetScore;
  }

  // calculate the initial roll modifiers
  // there can be further adjusted
  static getRollModifiers(action) {
    let total = 0;
    // +10 if taking defend action
    if (action == CombatAction.DEFEND) {
      total += 10;
    }
    //  magic bonus
    // THEN multiple target modifier
    //  number of targets (n -1) * -5
    // THEN combat modifiers
    //  cover?
    //  height advantage/penalty
    //  immobile advantage/penalty
    // THEN passion modifier
    // THEN other
    return total;
  }

  // this presents a dialog that lets you adjust the bonus
  // returns null if the roll is canceled
  static async requestRollModifiers(action) {
    const bonuses = this.getRollModifiers(action);
    const textInput = fields.createNumberInput({
      name: "checkBonus",
      value: bonuses,
    });
    const textGroup = fields.createFormGroup({
      input: textInput,
      label: game.i18n.localize("PEN.checkBonus"),
      hint: game.i18n.localize("PEN.checkBonusHint"),
    });
    const content = `${textGroup.outerHTML}`;
    const data = await api.DialogV2.input({
      window: { title: `PEN.actions.${action}` },
      content: content,
      ok: { label: "Roll" },
    });
    return data?.checkBonus;
  }

  static defaultOptions(actor, action) {
    return {
      actor,
      particName: actor.name,
      particId: actor.id,
      particImg: actor.img,
      particType: "actor",
      actorType: actor.type,
      rollType: RollType.COMBAT,
      cardType: CardType.COMBAT,
      rollFormula: "1D20",
      state: ChatCardState.OPEN,
      chatTemplate: ChatCardTemplate.COMBAT,
      chatType: CONST.CHAT_MESSAGE_STYLES.OTHER,
      action,
      flatMod: 0,
      reflexMod: 0,
    };
  }

  // make a fairly standard opposed combat roll using weapon skill
  // returns null if the roll dialog is canceled
  static async opposedWeaponRollOptions(actor, action) {
    // default to unarmed
    let currentWeapon = {
      id: null,
      name: "Unarmed",
      total: actor.getSkillTotal("i.skill.brawling"),
      damage: actor.system.damage,
      skillId: actor.getItemByPid("i.skill.brawling")?.id,
    };
    // determine skill based on current weapon
    const weapon = actor.currentWeapon();
    if (weapon) {
      currentWeapon = {
        id: weapon.id,
        name: weapon.name,
        total: weapon.system.total,
        damage: weapon.system.damage,
        skillId: weapon.system.sourceId,
      };
    }
    // mounted charge adjustments
    if (action == CombatAction.CHARGE) {
      // expected to be on combat trained horse
      const horseDamage = actor.currentHorse().system.chargeDmg;
      currentWeapon.skillId = actor.getItemByPid("i.skill.charge")?.id;
      // effective charge skill is lower of charge or weapon skill
      const chargeSkillTotal = actor.getSkillTotal("i.skill.charge");
      currentWeapon.total = Math.min(chargeSkillTotal, weapon.system.total);
      // if dmgChar = "h" use the horse's charge damage
      // TODO: special case spear as lance
      if (weapon && weapon.system.damageChar == "h") {
        currentWeapon.damage = horseDamage;
      }
      if (weapon && weapon.system.damageChar != "h") {
        const weaponDamageDice = actor.system.damage + Number(weapon.system.damageMod) + 1;
        const dmgDice = Math.min(weaponDamageDice, Number.parseInt(horseDamage));
        const dmgModifier = Number(weapon.system.damageBonus) + Number(actor.system.damageMod);
        //a two-handed grip adds +2D6 damage
        const twoHandBonus = actor.getTwoHandedBonus(weapon);
        const dice = dmgDice + twoHandBonus;
        currentWeapon.damage = `${dice}D6`;
        if (dmgModifier != 0) {
          currentWeapon.damage = `${dice}D6 + ${dmgModifier}`;
        }
      }
    }
    const targetScore = this.applyHorsemanshipCap(actor, currentWeapon);
    // will use as flatMod but later make more granular
    const modifier = await this.requestRollModifiers(action);
    if (modifier == null) return null;
    // opposed roll by default
    const options = {
      ...this.defaultOptions(actor, action),
      ...this.calcTargets(targetScore, modifier),
      itemId: currentWeapon.id,
      flatMod: modifier,
      label: currentWeapon.name,
      rawScore: currentWeapon.total,
      skillId: currentWeapon.skillId,
      itemDamage: currentWeapon.damage,
    };
    return options;
  }

  // modify the target score and crit bonus
  static calcTargets(targetScore, modifier) {
    const grossTarget = targetScore + modifier;
    const options = {
      grossTarget,
      targetScore: grossTarget,
      critBonus: 0,
    };
    if (grossTarget > 20) {
      options.critBonus = grossTarget - 20;
      options.targetScore = 20;
    } else if (grossTarget < 0) {
      options.critBonus = -grossTarget;
      options.targetScore = 0;
    }
    return options;
  }

  // adjust modifiers based on opponent
  // these should alway be applied after opposed roll is made
  // but before outcome is calculated
  static adjustOpposingModifiers(config, opponent) {
    const originalTarget = config.grossTarget - config.flatMod;
    //  reckless vs defend (treat as attack vs attack; cancel defend bonus)
    if (config.action == CombatAction.DEFEND && opponent.action == this.RECKLESS) {
      config.flatMod -= 10;
    }
    //  TODO: mounted vs foot or foot vs prone(height advantage)
    //  TODO: foot using reach weapon vs mounted (cancels height advantage)
    //  opponent using reckless +5
    if (config.action != CombatAction.DEFEND && opponent.action == this.RECKLESS) {
      config.flatMod += 5;
    }
    // TODO: charge using lance/spear, opponent not using reach weapon

    // recalculate the gross target
    const grossTarget = originalTarget + config.flatMod;
    // if this hasn't changed, we don't need to do anything
    if (grossTarget == config.grossTarget) {
      return;
    }
    // re-calculate target and crit bonus
    if (grossTarget > 20) {
      config.critBonus = grossTarget - 20;
      config.targetScore = 20;
    } else if (grossTarget < 0) {
      config.critBonus = -grossTarget;
      config.targetScore = 0;
    } else {
      config.targetScore = grossTarget;
      config.critBonus = 0;
    }
    config.grossTarget = grossTarget;

    // cap result at 20 per original check
    config.rollVal = Math.min(Number(config.rollResult + config.critBonus), 20);
    config.resultLevel = PENCheck.successLevel(config);
  }

  // adjust damage formulas that depend on the opposing action
  // e.g. set spear strikes the charger using the opponent's (or the mount's) damage
  static async adjustDamage(config, opponent) {
    if (config.action == CombatAction.SET_SPEAR && opponent.action == CombatAction.CHARGE) {
      config.itemDamage = await this.setSpearDamage(config, opponent);
    }
  }

  static async setSpearDamage(config, opponent) {
    let damageFormula = opponent?.itemDamage ?? "";
    if (!damageFormula) {
      // fall back to the opponent's weapon damage formula
      const attacker = await PENactorDetails._getParticipant(opponent?.particId, opponent?.particType);
      const weapon = attacker?.items?.get(opponent?.itemId);
      if (weapon) {
        damageFormula = attacker.type === "character" ? weapon.system.damage : weapon.system.dmgForm;
      }
    }
    // a two-handed spear grip adds +2D6
    if (damageFormula && config.actor?.getTwoHandedBonus?.(config.actor.items.get(config.itemId))) {
      damageFormula = `${damageFormula}+2D6`;
    }
    return damageFormula || null;
  }

  static applyUnopposedOutcome(options) {
    if (options.resultLevel === RollResult.CRITICAL) {
      options.damCrit = true;
    }

    if (options.resultLevel > RollResult.FAIL) {
      options.damRoll = true;
      options.outcome = CombatOutcome.WIN;
      options.outcomeLabel = game.i18n.localize("PEN.comRollW");
    } else {
      options.outcome = CombatOutcome.LOSE;
      options.outcomeLabel = game.i18n.localize("PEN.comRollL");
    }
  }

  // Standard Attack
  static async attack(actor, unopposed = false) {
    // standard opposed weapon roll
    const options = await this.opposedWeaponRollOptions(actor, CombatAction.ATTACK);
    if (options == null) return;

    // allow for unopposed roll
    if (unopposed) {
      options.action = CombatAction.UNOPPOSED_ATTACK;
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
    }

    await this.createChatCard(options);
  }

  // Reckless Attack
  static async reckless(actor, unopposed = false) {
    // standard opposed weapon roll
    const options = await this.opposedWeaponRollOptions(actor, CombatAction.RECKLESS);
    if (options == null) return;

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
    }

    await this.createChatCard(options);
  }

  // DEFEND
  static async defend(actor, unopposed = false) {
    // standard opposed weapon roll
    const options = await this.opposedWeaponRollOptions(actor, CombatAction.DEFEND);
    if (options == null) return;

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
    }

    await this.createChatCard(options);
  }

  static async mount(actor, unopposed = false) {
    const targetScore = this.applyHorsemanshipCap(actor, {
      total: actor.system.move,
    });
    // will use as flatMod but later make more granular
    const modifier = await this.requestRollModifiers(CombatAction.MOUNT);
    if (modifier == null) return;
    // opposed roll by default
    const options = {
      ...this.defaultOptions(actor, CombatAction.MOUNT),
      ...this.calcTargets(targetScore, modifier),
      flatMod: modifier,
      label: game.i18n.localize("PEN.move"),
      rawScore: actor.system.move,
    };
    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
      // leap into saddle requires a roll
      // or mount carefully unopposed
      actor.mountCurrentHorse();
      await this.createDeclarationCard(options, `${options.particName} mounts their horse.`);
      return;
    }
    // make the roll
    await PENCheck.makeRoll(options);
    await this.createChatCard(options);
  }

  static async dismount(actor, unopposed = false) {
    if (!actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.mountedOnlyAction"));
      return;
    }
    const targetScore = this.applyHorsemanshipCap(actor, {
      total: actor.system.move,
    });
    // will use as flatMod but later make more granular
    const modifier = await this.requestRollModifiers(CombatAction.DISMOUNT);
    if (modifier == null) return;
    // opposed roll by default
    const options = {
      ...this.defaultOptions(actor, CombatAction.DISMOUNT),
      ...this.calcTargets(targetScore, modifier),
      flatMod: modifier,
      label: game.i18n.localize("PEN.move"),
      rawScore: actor.system.move,
    };
    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
      // leap out of saddle requires a roll
      // or mount carefully unopposed
      actor.dismountCurrentHorse();
      await this.createDeclarationCard(options, `${options.particName} dismounts their horse.`);
      return;
    }
    // make the roll
    await PENCheck.makeRoll(options);
    await this.createChatCard(options);
  }

  static async claimPrisoner(actor) {
    const options = {
      action: CombatAction.PRISONER,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    await this.createDeclarationCard(options, `${options.particName} claims a prisoner.`);
  }

  static async callSquire(actor) {
    const options = {
      action: CombatAction.SQUIRE,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    // squire skill; special card to choose action on success
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  // DISARM
  // attempt to knock away the opponent's weapon or object; Weapon Skill vs. opponent's Action
  // crit: weapon flies out of easy reach or lands at the character's feet
  // win: opponent drops the weapon or object within reach
  static async disarm(actor, unopposed = false) {
    // standard opposed weapon roll
    const options = await this.opposedWeaponRollOptions(actor, CombatAction.DISARM);
    if (options == null) return;

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
      // disarming does not inflict damage
      options.damRoll = false;
      options.damCrit = false;
    }

    await this.createChatCard(options);
  }

  // EVADE
  // disengage from melee combat; Movement Rate (horse's rate if mounted) vs. opponent's Action
  // win: neither take nor deal damage and no longer engaged
  // fumble: fall to the ground; if mounted, fall from the horse and take 1D6 damage
  static async evade(actor, unopposed = false) {
    const moveRate = actor.getMoveRate();
    const targetScore = this.applyHorsemanshipCap(actor, { total: moveRate });
    const modifier = await this.requestRollModifiers(CombatAction.EVADE);
    if (modifier == null) return;
    const options = {
      ...this.defaultOptions(actor, CombatAction.EVADE),
      ...this.calcTargets(targetScore, modifier),
      flatMod: modifier,
      label: game.i18n.localize("PEN.move"),
      rawScore: moveRate,
    };

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
      // evading does not inflict damage
      options.damRoll = false;
      options.damCrit = false;
    }

    await this.createChatCard(options);
  }

  static async pickUp(actor, unopposed = false) {
    const options = {
      action: CombatAction.PICKUP,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    // automatic success if unopposed
    // else DEX+5
    await this.createDeclarationCard(options, `${options.particName} picks up an object within easy reach.`);
  }

  static async selfSacrifice(actor) {
    const options = {
      action: CombatAction.SACRIFICE,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    // GM needs to approve, no roll needed
    // auto-success, max crit damage, character dies heroically at the end
    // roll.evaluate({maximize:true})
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  static async study(actor) {
    const options = {
      action: CombatAction.STUDY,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    // if attacked, can switch action with -5 penalty
    await this.createDeclarationCard(options, `${options.particName} studies the combat scene carefully.`);
  }

  static async withholdDamage(actor) {
    const options = {
      action: CombatAction.WITHHOLD,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    //choose either reduce by X dice or 1/2 damage
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  // ZIGZAG
  // evasive action used while moving; effective only against missile attacks
  // unopposed Movement Rate roll (horse's rate if mounted) made prior to the missile attack
  // crit: opponent -10 Missile Weapon Skill, move up to full Movement Rate
  // success: opponent -5 Missile Weapon Skill, move up to half Movement Rate
  // failure: no modifier, move up to half Movement Rate
  // fumble: no modifier, stumble and lose all Movement Rate
  static async zigzag(actor) {
    const moveRate = actor.getMoveRate();
    const targetScore = this.applyHorsemanshipCap(actor, { total: moveRate });
    const modifier = await this.requestRollModifiers(CombatAction.ZIGZAG);
    if (modifier == null) return;
    // unarmoured characters get a +5 zigzag bonus
    const zigzagMod = Number(modifier) + (actor.isWearingArmor() ? 0 : 5);
    // always unopposed
    const options = {
      ...this.defaultOptions(actor, CombatAction.ZIGZAG),
      ...this.calcTargets(targetScore, zigzagMod),
      flatMod: zigzagMod,
      label: game.i18n.localize("PEN.move"),
      rawScore: moveRate,
      cardType: CardType.UNOPPOSED,
      state: ChatCardState.CLOSED,
    };

    // make the roll
    await PENCheck.makeRoll(options);

    // the result imposes a penalty on the attacking archer
    switch (options.resultLevel) {
      case RollResult.CRITICAL:
        options.outcome = CombatOutcome.WIN;
        options.outcomeLabel = game.i18n.localize("PEN.comRollW");
        options.outcomeNote = game.i18n.localize("PEN.actionNote.zigzagCritical");
        break;
      case RollResult.SUCCESS:
        options.outcome = CombatOutcome.WIN;
        options.outcomeLabel = game.i18n.localize("PEN.comRollW");
        options.outcomeNote = game.i18n.localize("PEN.actionNote.zigzagSuccess");
        break;
      case RollResult.FUMBLE:
        options.outcome = CombatOutcome.FUMBLE;
        options.outcomeLabel = game.i18n.localize("PEN.comRollF");
        options.outcomeNote = game.i18n.localize("PEN.actionNote.zigzagFumble");
        break;
      default:
        options.outcomeLabel = game.i18n.localize("PEN.comRollL");
        options.outcomeNote = game.i18n.localize("PEN.actionNote.zigzagFail");
        break;
    }

    await this.createChatCard(options);
  }

  static async charge(actor, unopposed = false) {
    if (!actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.mountedOnlyAction"));
      return;
    }
    if (!actor.currentHorse().system.combat) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.needCombatTrainedMount"));
      return;
    }
    if (!actor.currentWeapon()?.system.canCharge) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.currentWeaponCannotCharge"));
      return;
    }
    // standard opposed weapon roll
    const options = await this.opposedWeaponRollOptions(actor, CombatAction.CHARGE);
    if (options == null) return;

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
    }

    await this.createChatCard(options);
  }

  static async controlMount(actor) {
    if (!actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.mountedOnlyAction"));
      return;
    }
    const options = {
      action: CombatAction.CONTROL_MOUNT,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    // make at start of round if mount is unsettled
    //   not combat trained, always starts unsettled, -5 penalty
    //   5+ dmg becomes unsettled
    // Horsemanship (penalty = HP lost this combat)
    // if combat trained, settle on success
    // otherwise settle on crit
    // fumble means thrown (quick dismount!)
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  static async trample(actor) {
    if (!actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.mountedOnlyAction"));
      return;
    }
    if (!actor.currentHorse().system.combat) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.needCombatTrainedMount"));
      return;
    }
    const options = {
      action: CombatAction.TRAMPLE,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    // Horsemanship, apply horse's normal dmg on win
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  static async quickDismount(actor) {
    if (!actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.mountedOnlyAction"));
      return;
    }
    const options = {
      action: CombatAction.QUICK_DISMOUNT,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  // DODGE
  // recklessly throw yourself aside to avoid damage; melee attacks only
  // unmounted and on foot only; the single Movement Rate roll is pitted against
  // all the opponents' rolls and forgoes the usual penalty for multiple opponents
  static async dodge(actor, unopposed = false) {
    if (actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.unmountedOnlyAction"));
      return;
    }
    // must be on their feet (i.e. not knocked down)
    if (actor.statuses.has(PendragonStatusEffects.PRONE)) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.mustBeOnFoot"));
      return;
    }
    const targetScore = actor.getMoveRate();
    const modifier = await this.requestRollModifiers(CombatAction.DODGE);
    if (modifier == null) return;
    const options = {
      ...this.defaultOptions(actor, CombatAction.DODGE),
      ...this.calcTargets(targetScore, modifier),
      flatMod: modifier,
      label: game.i18n.localize("PEN.move"),
      rawScore: targetScore,
    };

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
      // dodging does not inflict damage
      options.damRoll = false;
      options.damCrit = false;
    }

    await this.createChatCard(options);
  }

  static async donArmor(actor) {
    if (actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.unmountedOnlyAction"));
      return;
    }
    const options = {
      action: CombatAction.ARMOR,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    await this.createDeclarationCard(options, `${options.particName} dons their armor.`);
  }

  static async hook(actor) {
    if (actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.unmountedOnlyAction"));
      return;
    }
    // weapon skill
    // crit = auto opponent pulled down, falls if mounted
    // success = unopposed STR to pull down
    const options = {
      action: CombatAction.HOOK,
      particName: actor.name,
      particImg: actor.img,
      actor: actor,
    };
    await this.createDeclarationCard(options, `${options.particName} NOT IMPLEMENTED`);
  }

  // SET SPEAR
  // counter a declared or potential Charge attack; unmounted only
  // Spear Skill vs. opponent's Action
  // only works against an opponent using the Charge Skill; otherwise counts as a simple Attack
  // on a win: strike the charger using the opponent's (or mount's) damage plus any
  // weapon damage bonus; excess damage to the rider if the horse dies
  static async setSpear(actor, unopposed = false) {
    if (actor.isMounted()) {
      ui.notifications.warn(game.i18n.localize("PEN.warn.unmountedOnlyAction"));
      return;
    }
    // requires a spear as the current weapon
    const weapon = actor.currentWeapon();
    if (!weapon || weapon.system.skill != "spear") {
      ui.notifications.warn(game.i18n.localize("PEN.warn.needSpear"));
      return;
    }
    // standard opposed weapon roll using the spear skill
    const options = await this.opposedWeaponRollOptions(actor, CombatAction.SET_SPEAR);
    if (options == null) return;

    // allow for unopposed roll
    if (unopposed) {
      options.cardType = CardType.UNOPPOSED;
      options.state = ChatCardState.CLOSED;
    }

    // make the roll
    await PENCheck.makeRoll(options);

    // set the outcome if unopposed
    if (unopposed) {
      this.applyUnopposedOutcome(options);
    }

    await this.createChatCard(options);
  }

  // used to declare an unopposed action with an automatic success
  // examples: don armor, study, pick up, claim prisoner
  static async createDeclarationCard(config, message) {
    const messageData = {
      action: config.action,
      actionLabel: game.i18n.localize(`PEN.actions.${config.action}`),
      image: config.particImg,
      name: config.particName,
      message: message,
    };
    const html = await foundry.applications.handlebars.renderTemplate(ChatCardTemplate.DECLARE, messageData);
    const chatData = {
      user: game.user.id,
      content: html,
      speaker: {
        actor: config.actor._id,
        alias: config.actor.name,
      },
    };
    await ChatMessage.create(chatData);
  }

  static async createChatCard(config) {
    const chatMsgData = {
      rollType: config.rollType,
      cardType: config.cardType,
      chatType: config.chatType,
      chatTemplate: config.chatTemplate,
      state: config.state,
      rolls: config.roll,
      resultLevel: config.resultLevel,
      rollResult: config.rollResult,
      inquiry: config.inquiry,
      chatCard: [
        {
          rollType: config.rollType,
          particId: config.particId,
          particType: config.particType,
          particName: config.particName,
          particImg: config.particImg,
          actorType: config.actorType,
          characteristic: config.characteristic ?? false,
          label: config.label,
          oppLabel: config.oppLabel,
          oppRawScore: config.oppRawScore,
          decision: config.decision,
          reverseRoll: config.reverseRoll,
          reflex: config.reflex,
          skillId: config.skillId,
          itemId: config.itemId,
          targetScore: config.targetScore,
          grossTarget: config.grossTarget,
          rawScore: config.rawScore,
          rollFormula: config.rollFormula,
          flatMod: config.flatMod,
          reflexMod: config.reflexMod,
          critBonus: config.critBonus,
          rollResult: config.rollResult,
          rollVal: config.rollVal,
          roll: config.roll,
          resultLevel: config.resultLevel,
          resultLabel: game.i18n.localize(`PEN.resultLevel.${config.resultLevel}`),
          outcome: config.outcome,
          outcomeLabel: config.outcomeLabel,
          outcomeNote: config.outcomeNote,
          damRoll: config.damRoll,
          damCrit: config.damCrit,
          damShield: config.damShield,
          damMod: config.damMod,
          subType: config.subType,
          fixedOpp: config.fixedOpp,
          action: config.action,
          actionLabel: game.i18n.localize(`PEN.actions.${config.action}`),
          itemDamage: config.itemDamage,
          userID: config.userID,
          neutralRoll: config.neutralRoll,
        },
      ],
    };

    // updated existing card, if any
    const existingOpenCard = await OPCard.checkNewMsg(config);
    if (existingOpenCard) {
      await OPCard.OPAdd(chatMsgData, existingOpenCard);
      return;
    }
    // create a new card
    const html = await PENCheck.startChat(chatMsgData);
    const msgID = await PENCheck.showChat(html, chatMsgData);
    return msgID;
  }
}
