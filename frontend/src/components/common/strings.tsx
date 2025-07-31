export function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Regular expression for validating IPv4 addresses
const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
// Regular expression for validating IPv6 addresses
const ipv6Pattern = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|::1$/;
// Regular expression for validating hostnames
const hostnamePattern = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
// Regular expression for validating simple hostnames (without TLD)
const simpleHostnamePattern = /^[a-zA-Z0-9-]+$/;

/**
 * Checks if a string is a valid URL.
 * @param {string} str - The string to validate as a URL.
 * @returns {boolean} - Returns `true` if the string is a valid URL, otherwise `false`.
 */
export function isValidUrl(str: string) {
    // Check if the string is empty
    if (!str || str.trim() === "") {
        return false;
    }
    // Check if the string matches the IPv4 pattern
    if (
        ipv4Pattern.test(str) ||
        ipv6Pattern.test(str) ||
        hostnamePattern.test(str) ||
        simpleHostnamePattern.test(str)
    ) {
        return true;
    }

    try {
        // Attempt to create a URL object from the string
        new URL(str);
        return true;
    } catch {
        // If an error is thrown, the string is not a valid URL
        return false;
    }
}
