import crypto from "crypto";

export const generateSessionId = (): string => {
	return crypto.randomBytes(8).toString("hex");
};

export const generateName = (): string => {
	return crypto.randomBytes(4).toString("hex");
};

export const verify = (signString, streamId, secret): boolean => {
	if (!signString) return false;
};
