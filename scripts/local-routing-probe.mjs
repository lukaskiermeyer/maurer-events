for(const host of ['127.0.0.1','localhost'])for(const language of ['de','en','*']) {
  try {
    const response=await fetch(`http://${host}:3100/`,{redirect:'manual',headers:{'Accept-Language':language},signal:AbortSignal.timeout(3000)});
    console.log(host,language,response.status,response.headers.get('location'),response.headers.get('x-middleware-rewrite'));
  } catch(error) {console.log(host,language,error.name)}
}
