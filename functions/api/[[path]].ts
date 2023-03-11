export const onRequest: PagesFunction<{ MUTEX_API: Fetcher }> = ({
	request,
	env,
}) => env.MUTEX_API.fetch(request);
