export class PENSelectLists {
  //
  //Weapon Types
  //
  static getWeaponTypes() {
    let options = {
      "": game.i18n.localize("PEN.none"),
      bow: game.i18n.localize("PEN.bow"),
      brawling: game.i18n.localize("PEN.brawling"),
      charge: game.i18n.localize("PEN.charge"),
      crossbow: game.i18n.localize("PEN.crossbow"),
      flail: game.i18n.localize("PEN.flail"),
      hafted: game.i18n.localize("PEN.hafted"),
      twoHand: game.i18n.localize("PEN.twoHand"),
      spear: game.i18n.localize("PEN.spear"),
      sword: game.i18n.localize("PEN.sword"),
      thrown: game.i18n.localize("PEN.thrown"),
    };
    return options;
  }

  //Weapon Usage
  static getWeaponUse() {
    let options = {
      mounted: game.i18n.localize("PEN.mounted"),
      unmounted: game.i18n.localize("PEN.unmounted"),
      both: game.i18n.localize("PEN.both"),
    };
    return options;
  }

  //wield options; a weapon can always be carried or dropped. Inherently two-handed weapons
  //may not be used in one hand, except lances, which revert to spear use so they can pair
  //with a shield when not charging
  static getWieldTypes(weaponSystem) {
    const options = {
      carried: game.i18n.localize("PEN.wield.carried"),
      dropped: game.i18n.localize("PEN.wield.dropped"),
    };
    if (!weaponSystem?.twoHandedOnly || weaponSystem.skill === "charge") {
      options.primaryHand = game.i18n.localize("PEN.wield.primaryHand");
    }
    if (weaponSystem?.canBeTwoHanded) {
      options.twoHanded = game.i18n.localize("PEN.wield.twoHanded");
    }
    return options;
  }

  //Weapon Damage
  static getWeaponDmg() {
    let options = {
      c: game.i18n.localize("PEN.character"),
      b: game.i18n.localize("PEN.brawling"),
      h: game.i18n.localize("PEN.horse"),
      n: game.i18n.localize("PEN.none"),
    };
    return options;
  }

  //Weapon Damage
  static getWeaponRange() {
    let options = {
      s: game.i18n.localize("PEN.short"),
      m: game.i18n.localize("PEN.medium"),
      l: game.i18n.localize("PEN.long"),
    };
    return options;
  }

  //Passion Types
  static getCourtType() {
    let options = {
      adoratio: game.i18n.localize("PEN.adoratio"),
      civilitas: game.i18n.localize("PEN.civilitas"),
      fervor: game.i18n.localize("PEN.fervor"),
      fidelitas: game.i18n.localize("PEN.fidelitas"),
      honor: game.i18n.localize("PEN.honor"),
    };
    return options;
  }

  //Stats List + None
  static getSkillAtt() {
    let options = {
      none: game.i18n.localize("PEN.none"),
      app: game.i18n.localize("PENDRAGON.StatAppAbbr"),
      con: game.i18n.localize("PENDRAGON.StatConAbbr"),
      dex: game.i18n.localize("PENDRAGON.StatDexAbbr"),
      siz: game.i18n.localize("PENDRAGON.StatSizAbbr"),
      str: game.i18n.localize("PENDRAGON.StatStrAbbr"),
    };
    return options;
  }

  //Armour Type List
  static getArmourType() {
    let options = {
      textile: game.i18n.localize("PEN.textile"),
      mail: game.i18n.localize("PEN.mail"),
      plate: game.i18n.localize("PEN.plate"),
    };
    return options;
  }

  //Damage Type List
  static getDamageType() {
    let options = {
      wound: game.i18n.localize("PEN.wound"),
      cold: game.i18n.localize("PEN.cold"),
      disease: game.i18n.localize("PEN.disease"),
      fire: game.i18n.localize("PEN.fire"),
      fall: game.i18n.localize("PEN.fall"),
      poison: game.i18n.localize("PEN.poison"),
      suffocate: game.i18n.localize("PEN.suffocate"),
    };
    return options;
  }

  //Stats List + HP
  static getDiseaseImpact() {
    let options = {
      hp: game.i18n.localize("PEN.hp"),
      app: game.i18n.localize("PENDRAGON.StatAppAbbr"),
      con: game.i18n.localize("PENDRAGON.StatConAbbr"),
      dex: game.i18n.localize("PENDRAGON.StatDexAbbr"),
      siz: game.i18n.localize("PENDRAGON.StatSizAbbr"),
      str: game.i18n.localize("PENDRAGON.StatStrAbbr"),
    };
    return options;
  }

  //Standards of Living List
  static getSOLType() {
    let options = {
      impoverished: game.i18n.localize("PEN.impoverished"),
      poor: game.i18n.localize("PEN.poor"),
      ordinary: game.i18n.localize("PEN.ordinary"),
      rich: game.i18n.localize("PEN.rich"),
      superlative: game.i18n.localize("PEN.superlative"),
    };
    return options;
  }

  //relation Types
  static getRelationTypes() {
    let options = {
      parent: game.i18n.localize("PEN.parent"),
      spouse: game.i18n.localize("PEN.spouse"),
      child: game.i18n.localize("PEN.child"),
      other: game.i18n.localize("PEN.other"),
    };
    return options;
  }

  //Squire Types
  static getSquireTypes() {
    let options = {
      squire: game.i18n.localize("PEN.squire"),
      maiden: game.i18n.localize("PEN.maiden"),
      other: game.i18n.localize("PEN.other"),
    };
    return options;
  }

  //Horse Status
  static getHorseStatus() {
    let options = {
      0: game.i18n.localize("PEN.good"),
      1: game.i18n.localize("PEN.weak"),
      2: game.i18n.localize("PEN.vweak"),
    };
    return options;
  }

  //Follower Type
  static getFollowerType() {
    let options = {
      squire: game.i18n.localize("PEN.squire"),
      family: game.i18n.localize("PEN.family"),
      retainer: game.i18n.localize("PEN.retainer"),
    };
    return options;
  }

  //Background Character Type
  static getBackgroundType() {
    let options = {
      professional: game.i18n.localize("PEN.manor.professional"),
      officer: game.i18n.localize("PEN.manor.officer"),
      academic: game.i18n.localize("PEN.manor.academic"),
      companion: game.i18n.localize("PEN.manor.companion"),
      entertainer: game.i18n.localize("PEN.manor.entertainer"),
      healer: game.i18n.localize("PEN.manor.healer"),
    };
    return options;
  }

  //Career Paths Type
  static getFollowerType() {
    let options = {
      familycourtier: game.i18n.localize("PEN.path.familycourtier"),
      familyladies: game.i18n.localize("PEN.path.familyladies"),
      monk: game.i18n.localize("PEN.path.monk"),
      nun: game.i18n.localize("PEN.path.nun"),
      religionchristianmen: game.i18n.localize("PEN.path.religionchristianmen"),
      religionpaganmen: game.i18n.localize("PEN.path.religionpaganmen"),
      religionpaganwomen: game.i18n.localize("PEN.path.religionpaganwomen"),
      service: game.i18n.localize("PEN.path.service"),
      sword: game.i18n.localize("PEN.path.sword"),
    };
    return options;
  }

  //Battle Posture
  static getBattlePos() {
    let options = {
      0: game.i18n.localize("PEN.battlePos.0"),
      1: game.i18n.localize("PEN.battlePos.1"),
      2: game.i18n.localize("PEN.battlePos.2"),
      3: game.i18n.localize("PEN.battlePos.3"),
      R: game.i18n.localize("PEN.battlePos.R"),
    };
    return options;
  }

  //Field Position
  static getFieldPos() {
    let options = {
      0: game.i18n.localize("PEN.fieldPos.0"),
      1: game.i18n.localize("PEN.fieldPos.1"),
      2: game.i18n.localize("PEN.fieldPos.2"),
      3: game.i18n.localize("PEN.fieldPos.3"),
    };
    return options;
  }

  //Manor Improvement Sub-types
  static getImprovType() {
    let options = {
      def: game.i18n.localize("PEN.manor.def"),
      enh: game.i18n.localize("PEN.manor.enh"),
      manImp: game.i18n.localize("PEN.manor.manImp"),
      inv: game.i18n.localize("PEN.manor.inv"),
      not: game.i18n.localize("PEN.manor.not"),
      barInv: game.i18n.localize("PEN.manor.barInv"),
    };
    return options;
  }

  //Manor DV Improvement Sub-types
  static getDVImprovType() {
    let options = {
      citywalls: game.i18n.localize("PEN.dv.citywalls"),
      outworks: game.i18n.localize("PEN.dv.outworks"),
      outerbailey1: game.i18n.localize("PEN.dv.outerbailey1"),
      outerbailey2: game.i18n.localize("PEN.dv.outerbailey2"),
      outerbailey3: game.i18n.localize("PEN.dv.outerbailey3"),
      innerbailey1: game.i18n.localize("PEN.dv.innerbailey1"),
      innerbailey2: game.i18n.localize("PEN.dv.innerbailey2"),
      innerbailey3: game.i18n.localize("PEN.dv.innerbailey3"),
      motte1: game.i18n.localize("PEN.dv.motte1"),
      motte2: game.i18n.localize("PEN.dv.motte2"),
      motte3: game.i18n.localize("PEN.dv.motte3"),
      stronghold1: game.i18n.localize("PEN.dv.stronghold1"),
      stronghold2: game.i18n.localize("PEN.dv.stronghold2"),
      stronghold3: game.i18n.localize("PEN.dv.stronghold3"),
    };
    return options;
  }

  //Manor Maintenance
  static getMaintType() {
    let options = {
      maintained: game.i18n.localize("PEN.manor.maintained"),
      unmaintained: game.i18n.localize("PEN.manor.unmaintained"),
      ruined: game.i18n.localize("PEN.manor.ruined"),
      unavail: game.i18n.localize("PEN.manor.unavail"),
    };
    return options;
  }
}
