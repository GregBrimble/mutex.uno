export default {
	async fetch(request, env) {
		const { pathname, search } = new URL(request.url);
		if (pathname.startsWith("/api/")) {
			try {
				const id = env.MUTEX_API.idFromName(pathname);
				const stub = env.MUTEX_API.get(id);
				return await stub.fetch(request);
			} catch (error) {
				if ("remote" in error) {
					return new Response(null, { status: 502 });
				}

				return new Response(null, { status: 429 });
			}
		}

		return Response.redirect(`https://mutex.uno${pathname}${search}`);
	},
} as ExportedHandler<{ MUTEX_API: DurableObjectNamespace }>;

interface Lock {
	id: string;
	timestamp: Date;
}

const generateETag = (lock: Lock) => `"${lock.id}"`;
const generateLastModified = (lock: Lock) => {
	const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const monthsOfYear = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	const dayOfWeek = daysOfWeek[lock.timestamp.getUTCDay()];
	const dayOfMonth = lock.timestamp.getUTCDate().toString().padStart(2, "0");
	const monthOfYear = monthsOfYear[lock.timestamp.getUTCMonth()];
	const year = lock.timestamp.getUTCFullYear().toString();
	const hours = lock.timestamp.getUTCHours().toString().padStart(2, "0");
	const minutes = lock.timestamp.getUTCMinutes().toString().padStart(2, "0");
	const seconds = lock.timestamp.getUTCSeconds().toString().padStart(2, "0");

	return `${dayOfWeek}, ${dayOfMonth} ${monthOfYear} ${year} ${hours}:${minutes}:${seconds} GMT`;
};

const generateHeaders = (lock: Lock) => ({
	ETag: generateETag(lock),
	"Last-Modified": generateLastModified(lock),
});

export class Mutex implements DurableObject {
	state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	async fetch(request: Request) {
		let lock = await this.state.storage.get<Lock>("lock");

		const ifMatch = request.headers.get("If-Match");
		const ifMatchMatches =
			ifMatch === "*" || (lock ? ifMatch === generateETag(lock) : false);

		switch (request.method.toUpperCase()) {
			case "POST": {
				if (!lock || ifMatchMatches) {
					lock = { id: crypto.randomUUID(), timestamp: new Date() };
					await this.state.storage.put("lock", lock);
					return Response.json(lock, {
						status: 201,
						headers: generateHeaders(lock),
					});
				} else {
					return Response.json(lock, {
						status: ifMatch ? 412 : 409,
						headers: generateHeaders(lock),
					});
				}
			}
			case "DELETE": {
				if (!lock) {
					return new Response(null, { status: 404 });
				} else if (ifMatch && !ifMatchMatches) {
					return Response.json(lock, {
						status: 412,
						headers: generateHeaders(lock),
					});
				} else {
					lock = undefined;
					await this.state.storage.delete("lock");
					return new Response(null, { status: 204 });
				}
			}
			case "GET": {
				if (lock) {
					return Response.json(lock, {
						headers: generateHeaders(lock),
					});
				} else {
					return new Response(null, { status: 404 });
				}
			}
		}

		return new Response(null, { status: 405 });
	}
}
