class AntiRaid {
  constructor(config = {}) {
    this.rateLimitWindow = (config.rateLimitWindow || 10) * 1000;
    this.rateLimitMax = config.rateLimitMax || 5;
    this.muteDuration = (config.muteDuration || 300) * 1000;

    this.messageLog = new Map();
    this.mutedUsers = new Map();
    this.warnedUsers = new Map();
    this.spamPatterns = [
      /(.)\1{10,}/,
      /(.{3,})\1{4,}/,
      /(https?:\/\/\S+\s*){5,}/,
      /(@everyone|@here)\s*(@everyone|@here)/,
    ];
  }

  isMuted(userId) {
    if (!this.mutedUsers.has(userId)) return false;
    const muteEnd = this.mutedUsers.get(userId);
    if (Date.now() > muteEnd) {
      this.mutedUsers.delete(userId);
      return false;
    }
    return true;
  }

  getMuteRemaining(userId) {
    if (!this.mutedUsers.has(userId)) return 0;
    return Math.max(0, this.mutedUsers.get(userId) - Date.now());
  }

  muteUser(userId) {
    this.mutedUsers.set(userId, Date.now() + this.muteDuration);
  }

  isSpam(content) {
    return this.spamPatterns.some(pattern => pattern.test(content));
  }

  isRateLimited(userId) {
    const now = Date.now();
    if (!this.messageLog.has(userId)) {
      this.messageLog.set(userId, []);
    }

    const timestamps = this.messageLog.get(userId);
    const recent = timestamps.filter(t => now - t < this.rateLimitWindow);
    this.messageLog.set(userId, recent);
    recent.push(now);

    return recent.length > this.rateLimitMax;
  }

  check(userId, content) {
    if (this.isMuted(userId)) {
      const remaining = Math.ceil(this.getMuteRemaining(userId) / 1000);
      return {
        blocked: true,
        reason: 'muted',
        message: `おまえミュート中。あと${remaining}秒黙ってて。`,
      };
    }

    if (this.isSpam(content)) {
      this.muteUser(userId);
      return {
        blocked: true,
        reason: 'spam',
        message: 'スパムうざい。ミュートね。',
      };
    }

    if (this.isRateLimited(userId)) {
      const warned = this.warnedUsers.get(userId) || 0;
      if (warned >= 2) {
        this.muteUser(userId);
        this.warnedUsers.delete(userId);
        return {
          blocked: true,
          reason: 'rate_limit_mute',
          message: '何回言ったら分かんの？ミュート。',
        };
      }
      this.warnedUsers.set(userId, warned + 1);
      return {
        blocked: true,
        reason: 'rate_limit',
        message: 'しつこい。ちょっと待って。',
      };
    }

    return { blocked: false };
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, muteEnd] of this.mutedUsers) {
      if (now > muteEnd) this.mutedUsers.delete(userId);
    }
    for (const [userId, timestamps] of this.messageLog) {
      const recent = timestamps.filter(t => now - t < this.rateLimitWindow);
      if (recent.length === 0) this.messageLog.delete(userId);
      else this.messageLog.set(userId, recent);
    }
  }
}

module.exports = AntiRaid;
