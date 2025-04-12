export const relativeTime = (date?: Date) => {
    if (!date) return "never";

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);

    if (seconds < 60) {
        return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
    } else if (minutes < 60) {
        return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (days < 30) {
        return `${days} day${days > 1 ? "s" : ""} ago`;
    } else if (months < 12) {
        return `${months} month${months > 1 ? "s" : ""} ago`;
    } else {
        return `${years} year${years > 1 ? "s" : ""} ago`;
    }
};

/** Humanize the duration in seconds to a human readable format.
 */
export const humanizeDuration = (duration: number) => {
    const seconds = Math.floor(duration % 60);
    const minutes = Math.floor((duration / 60) % 60);
    const hours = Math.floor((duration / 60 / 60) % 24);
    const days = Math.floor(duration / 60 / 60 / 24);

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(" ");
};

export const trackLengthRep = (length?: number | null) => {
    if (length === undefined || length === null) {
        return "(?:??)";
    }
    // length is in seconds, but with floating precision
    const hours = Math.floor(length / 3600);
    const minutes = Math.floor((length % 3600) / 60);
    const seconds = Math.floor(length % 60);
    return `(${hours ? `${hours}h ` : ""}${minutes}:${seconds.toString().padStart(2, "0")})`;
};
