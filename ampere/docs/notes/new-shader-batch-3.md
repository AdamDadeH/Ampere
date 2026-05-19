https://www.shadertoy.com/view/ltl3WS

void mainImage(out vec4 o,vec2 i){
    vec3 p;
    for (float s=-1.,v; s++ < 2e3; p = abs(p)/v - .8 )
        int(s)%10 < 1
          ? o += v/1e3,
            p = vec3(.1,.2, fract(.01*ceil(.1*s+iTime*25.)) ),
            p.xy += s*i/3e6 : i,
        v = dot(p,p);}

https://www.shadertoy.com/view/Xls3D2

// Frozen wasteland
// By Dave Hoskins
// https://www.shadertoy.com/view/Xls3D2
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.


#define ITR 90
#define FAR 110.
#define time iTime
#define MOD3 vec3(.16532,.17369,.15787)
#define SUN_COLOUR  vec3(1., .95, .85)

#define TRIANGLE_NOISE	    // .. This
//#define TEXTURE_NOISE		// .. Or this (faster, but not as sharp edged)
//#define VALUE_NOISE 		// .. or more normal noise.
//#define FOUR_D_NOISE	    // ...Or movement


float height(in vec2 p)
{
    float h = sin(p.x*.1+p.y*.2)+sin(p.y*.1-p.x*.2)*.5;
    h += sin(p.x*.04+p.y*.01+3.0)*4.;
    h -= sin(h*10.0)*.1;
    return h;
}

float camHeight(in vec2 p)
{
    float h = sin(p.x*.1+p.y*.2)+sin(p.y*.1-p.x*.2)*.5;
    h += sin(p.x*.04+p.y*.01+3.0)*4.;
    return h;
}

float smin( float a, float b)
{
	const float k = 2.7;
	float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( b, a, h ) - k*h*(1.0-h);
}

#define MOD2 vec2(.16632,.17369)
#define MOD3 vec3(.16532,.17369,.15787)
float tri(in float x){return abs(fract(x)-.5);}

float hash12(vec2 p)
{
	p  = fract(p * MOD2);
    p += dot(p.xy, p.yx+19.19);
    return fract(p.x * p.y);
}
float vine(vec3 p, in float c, in float h)
{
    p.y += sin(p.z*.5625+1.3)*3.5-.5;
    p.x += cos(p.z*2.)*1.;
    vec2 q = vec2(mod(p.x, c)-c/2., p.y);
    return length(q) - h*1.4 -sin(p.z*3.+sin(p.x*7.)*0.5)*0.1;
}

//========================================================================
// ################ DIFFERENT NOISE FUNCTIONS ################
#ifdef TRIANGLE_NOISE
vec3 tri3(in vec3 p){return vec3( tri(p.z+tri(p.y)), tri(p.z+tri(p.x)), tri(p.y+tri(p.x)));}
float Noise3d(in vec3 p)
{
    float z=1.4;
	float rz = 0.;
    vec3 bp = p;
	for (float i=0.; i<= 2.; i++ )
	{
        vec3 dg = tri3(bp);
        p += (dg);

        bp *= 2.;
		z *= 1.5;
		p *= 1.3;
        
        rz+= (tri(p.z+tri(p.x+tri(p.y))))/z;
        bp += 0.14;
	}
	return rz;
}
#endif

//--------------------------------------------------------------------------------
#ifdef FOUR_D_NOISE

vec4 quad(in vec4 p){return abs(fract(p.yzwx+p.wzxy)-.5);}

float Noise3d(in vec3 q)
{
    float z=1.4;
    vec4 p = vec4(q, iTime*.1);
	float rz = 0.;
    vec4 bp = p;
	for (float i=0.; i<= 2.; i++ )
	{
        vec4 dg = quad(bp);
        p += (dg);

		z *= 1.5;
		p *= 1.3;
        
        rz+= (tri(p.z+tri(p.w+tri(p.y+tri(p.x)))))/z;
        
        bp = bp.yxzw*2.0+.14;
	}
	return rz;
}
#endif

//--------------------------------------------------------------------------------
#ifdef TEXTURE_NOISE
float Noise3d(in vec3 x)
{

    x*=10.0;
    float h = 0.0;
    float a = .28;
    for (int i = 0; i < 4; i++)
    {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f*f*(3.0-2.0*f);

        vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
        vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
        h += mix( rg.x, rg.y, f.z )*a;
        a*=.5;
        x+=x;
    }
    return h;
}
#endif


//--------------------------------------------------------------------------------
#ifdef VALUE_NOISE
float Hash(vec3 p)
{
	p  = fract(p * MOD3);
    p += dot(p.xyz, p.yzx + 19.19);
    return fract(p.x * p.y * p.z);
}

float Noise3d(in vec3 p)
{
    vec2 add = vec2(1.0, 0.0);
	p *= 10.0;
    float h = 0.0;
    float a = .3;
    for (int n = 0; n < 4; n++)
    {
        vec3 i = floor(p);
        vec3 f = fract(p); 
        f *= f * (3.0-2.0*f);

        h += mix(
            mix(mix(Hash(i), Hash(i + add.xyy),f.x),
                mix(Hash(i + add.yxy), Hash(i + add.xxy),f.x),
                f.y),
            mix(mix(Hash(i + add.yyx), Hash(i + add.xyx),f.x),
                mix(Hash(i + add.yxx), Hash(i + add.xxx),f.x),
                f.y),
            f.z)*a;
         a*=.5;
        p += p;
    }
    return h;
}
#endif

//--------------------------------------------------------------------------------
float map(vec3 p)
{
    p.y += height(p.zx);
    float d = p.y+.5;
    
    d = smin(d, vine(p+vec3(.8,0.,0),30.,3.3) );
    d = smin(d, vine(p.zyx+vec3(0.,0,17.),33.,1.4) );
    d += Noise3d(p*.05)*(p.y*1.2);
    p.xz *=.3;
    d+= Noise3d(p*.3);
    return d;
}
float fogmap(in vec3 p, in float d)
{
    p.xz -= time*7.+sin(p.z*.3)*3.;
    p.y -= time*.5;
    return (max(Noise3d(p*.008+.1)-.1,0.0)*Noise3d(p*.1))*.3;
}

vec3 fogColour( in vec3 col, float t )
{
    vec3 ext = exp2(-t*0.0001*vec3(1.,1.5,3.)); 
    return col*ext + (1.0-ext)*vec3(1.);
}



float march(in vec3 ro, in vec3 rd, out float drift, in vec2 scUV)
{
	float precis = 0.1;
    float mul = .34;
    float h;
    float d = hash12(scUV)*1.5;
    drift = 0.0;
    for( int i=0; i<ITR; i++ )
    {
        vec3 p = ro+rd*d;
        h = map(p);
        if(h < precis*(1.0+d*.05) || d > FAR) break;
        drift +=  fogmap(p, d);
        d += h*mul;
        mul+=.004;
        //precis +=.001;
	 }
    drift = min(drift, 1.0);
	return d;
}

vec3 normal( in vec3 pos, in float d )
{
	vec2 eps = vec2( d *d* .003+.01, 0.0);
	vec3 nor = vec3(
	    map(pos+eps.xyy) - map(pos-eps.xyy),
	    map(pos+eps.yxy) - map(pos-eps.yxy),
	    map(pos+eps.yyx) - map(pos-eps.yyx) );
	return normalize(nor);
}

float bnoise(in vec3 p)
{
    p.xz*=.4;
    float n = Noise3d(p*3.)*0.4;
    n += Noise3d(p*1.5)*0.2;
    return n*n*.2;
}

vec3 bump(in vec3 p, in vec3 n, in float ds)
{
    p.xz *= .4;
    //p *= 1.0;
    vec2 e = vec2(.01,0);
    float n0 = bnoise(p);
    vec3 d = vec3(bnoise(p+e.xyy)-n0, bnoise(p+e.yxy)-n0, bnoise(p+e.yyx)-n0)/e.x;
    n = normalize(n-d*10./(ds));
    return n;
}

float shadow(in vec3 ro, in vec3 rd, in float mint)
{
	float res = 1.0;
    
    float t = mint;
    for( int i=0; i<12; i++ )
    {
		float h = map(ro + rd*t);
        res = min( res, 4.*h/t );
        t += clamp( h, 0.1, 1.5 );
            }
    return clamp( res, 0., 1.0 );
}

vec3 Clouds(vec3 sky, vec3 rd)
{
    
    rd.y = max(rd.y, 0.0);
    float ele = rd.y;
    float v = (200.0)/(abs(rd.y)+.01);

    rd.y = v;
    rd.xz = rd.xz * v - time*8.0;
	rd.xz *= .0004;
    
	float f = Noise3d(rd.xzz*3.) * Noise3d(rd.zxx*1.3)*2.5;
    f = f*pow(ele, .5)*2.;
  	f = clamp(f-.15, 0.01, 1.0);

    return  mix(sky, vec3(1),f );
}


vec3 Sky(vec3 rd, vec3 ligt)
{
    rd.y = max(rd.y, 0.0);
    
    vec3 sky = mix(vec3(.1, .15, .25), vec3(.8), pow(.8-rd.y, 3.0));
    return  mix(sky, SUN_COLOUR, min(pow(max(dot(rd,ligt), 0.0), 4.5)*1.2, 1.0));
}
float Occ(vec3 p)
{
    float h = 0.0;
    h  = clamp(map(p), 0.5, 1.0);
 	return sqrt(h);   
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
    vec2 q = fragCoord.xy/iResolution.xy;
	p.x*=iResolution.x/iResolution.y;
    vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(-0.1,0.07):mo;
	mo.x *= iResolution.x/iResolution.y;
	
	vec3 ro = vec3(0.+smoothstep(0.,1.,tri(time*1.5)*.3)*1.5, smoothstep(0.,1.,tri(time*3.)*3.)*0.08, -time*3.5-130.0);
    ro.y -= camHeight(ro.zx)-.4;
    mo.x += smoothstep(0.7,1.,sin(time*.35))*.5-1.5 - smoothstep(-.7,-1.,sin(time*.35))*.5;
 
    vec3 eyedir = normalize(vec3(cos(mo.x),mo.y*2.-.05+sin(time*.5)*0.1,sin(mo.x)));
    vec3 rightdir = normalize(vec3(cos(mo.x+1.5708),0.,sin(mo.x+1.5708)));
    vec3 updir = normalize(cross(rightdir,eyedir));
	vec3 rd=normalize((p.x*rightdir+p.y*updir)*1.+eyedir);
	
    vec3 ligt = normalize( vec3(1.5, .9, -.5) );
    float fg;
	float rz = march(ro,rd, fg, fragCoord);
	vec3 sky = Sky(rd, ligt);
    
    vec3 col = sky;
   
    if ( rz < FAR )
    {
        vec3 pos = ro+rz*rd;
        vec3 nor= normal( pos, rz);
        float d = distance(pos,ro);
        nor = bump(pos,nor,d);
        float shd = (shadow(pos,ligt,.04));
        
        float dif = clamp( dot( nor, ligt ), 0.0, 1.0 );
        vec3 ref = reflect(rd,nor);
        float spe = pow(clamp( dot( ref, ligt ), 0.0, 1.0 ),5.)*2.;

        float fre = pow( clamp(1.+dot(rd, nor),0.0,1.0), 3. );
        col = vec3(.75);
	    col = col*dif*shd + fre*spe*shd*SUN_COLOUR +abs(nor.y)*vec3(.12, .13, .13);
        // Fake the red absorption of ice...
        d = Occ(pos+nor*3.);
        col *= vec3(d, d, min(d*1.2, 1.0));
        // Fog from ice storm...
        col = mix(col, sky, smoothstep(FAR-25.,FAR,rz));
        
    }
    else
    {
        col = Clouds(col, rd);
    }
    

    // Fog mix...
    col = mix(col, vec3(0.6, .65, .7), fg);
  
    // Post...
    col = fogColour(col, rz);

    col = col*col * (3.0 - 2. * col);
	//col = clamp(pow(col,vec3(1.5)),0.0, 1.0);

	col = sqrt(col);
    
    
    // Borders...
    float f = smoothstep(0.0, 3.0, iTime)*.5;
    col *= f+f*pow(70. *q.x*q.y*(1.0-q.x)*(1.0-q.y), .2);
    
    
	fragColor = vec4( col, 1.0 );
}

https://www.shadertoy.com/view/llsGWl

// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Created by S.Guillitte
//Based on Voronoise by iq :https://www.shadertoy.com/view/Xd23Dh
//and Gabor 4: normalized  by FabriceNeyret2 : https://www.shadertoy.com/view/XlsGDs

#define PI 3.14159265358979

int windows = 0;
vec2 m = vec2(.7,.8);

float hash( in vec2 p ) 
{
    return fract(sin(p.x*15.32+p.y*5.78) * 43758.236237153);
}


vec2 hash2(vec2 p)
{
	return vec2(hash(p*.754),hash(1.5743*p.yx+4.5891))-.5;
}

vec2 hash2b( vec2 p )
{
    vec2 q = vec2( dot(p,vec2(127.1,311.7)), 
				   dot(p,vec2(269.5,183.3)) );
	return fract(sin(q)*43758.5453)-.5;
}


mat2 m2= mat2(.8,.6,-.6,.8);

// Gabor/Voronoi mix 3x3 kernel (some artifacts for v=1.)
float gavoronoi3(in vec2 p)
{    
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float f = 2.*PI;//frequency
    float v = .8;//cell variability <1.
    float dv = .4;//direction variability <1.
    vec2 dir = m;//vec2(.7,.7);
    float va = 0.0;
   	float wt = 0.0;
    for (int i=-1; i<=1; i++) 
	for (int j=-1; j<=1; j++) 
	{		
        vec2 o = vec2(i, j)-.5;
        vec2 h = hash2(ip - o);
        vec2 pp = fp +o  -h;
        float d = dot(pp, pp);
        float w = exp(-d*4.);
        wt +=w;
        h = dv*h+dir;//h=normalize(h+dir);
        va += cos(dot(pp,h)*f/v)*w;
	}    
    return va/wt;
}


// Gabor/Voronoi mix 4x4 kernel (clean but slower)
float gavoronoi4(in vec2 p)
{    
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    vec2 dir = m;// vec2(.9,.7);
    float f = 2.*PI;																																										;//frequency
    float v = 1.;//cell variability <1.
    float dv = .7;//direction variability <1.
    float va = 0.0;
   	float wt = 0.0;
    for (int i=-2; i<=1; i++) 
	for (int j=-2; j<=1; j++) 
	{		
        vec2 o = vec2(i, j);
        vec2 h = hash2(ip - o);
        vec2 pp = fp +o  -v*h;
        float d = dot(pp, pp);
        float w = exp(-d*2.);
        wt +=w;
      	h= dv*h+dir;//h=normalize(h+dir);
        va +=cos(dot(pp,h)*f)*w;
	}    
    return va/wt;
}

// Gabor/Voronoi mix 5x5 kernel (even slower but suitable for large wavelets)
float gavoronoi5(in vec2 p) 
{    
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float f = 2.*PI;//frequency
    float v = .8;//cell variability <1.
    float dv = .8;//direction variability <1.
    vec2 dir = m;//vec2(.7,.7);
    float va = 0.0;
   	float wt = 0.0;
    for (int i=-2; i<=2; i++) 
	for (int j=-2; j<=2; j++) 
	{		
        vec2 o = vec2(i, j)-.5;
        vec2 h = hash2(ip - o);
        vec2 pp = fp +o  -h;
        float d = dot(pp, pp);
        float w = exp(-d*1.);
        wt +=w;
        h = dv*h+dir;//h=normalize(h+dir);
        va += cos(dot(pp,h)*f/v)*w;
	}    
    return va/wt;
}

  

//concentric waves variant
float gavoronoi3b(in vec2 p)
{    
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float f = 5.*PI;																																										;//frequency
    float v = 1.;//cell variability <1.
    float va = 0.0;
    float wt = 0.0;
    for (int i=-1; i<=1; i++) 
	for (int j=-1; j<=1; j++) 
	{		
        vec2 o = vec2(i, j)-.5;       		
        vec2 pp = fp +o  - v*hash2(ip - o);
        float d = dot(pp, pp);
        float w = exp(-d*4.);
        wt +=w;
        va +=cos(sqrt(d)*f)*w;
	}    
    return va/wt;
}



float noise( vec2 p)
{   
    return gavoronoi4(p);
}

float fbmabs( vec2 p ) {
	
	float f=1.;
   
	float r = 0.0;	
    for(int i = 0;i<6;i++){	
		r += abs(noise( p*f ))/f;       
	    f *=2.2;
        p+=vec2(-.01,.07)*r+.2*m*iTime/(.1-f);
	}
	return r;
}

float fbm( vec2 p ) {
	
	float f=1.;
   
	float r = 0.0;	
    for(int i = 0;i<8;i++){	
		r += noise( p*f )/f;       
	    f *=2.;
        p+=vec2(.01,-.05)*r+.2*m*iTime/(.1-f);
	}
	return r;
}

float map(vec2 p){

    if(windows==0)return noise(p*10.);
    if(windows==1)return 2.*abs( noise(p*10.));
	if(windows==2)return fbm(p)+1.;
    return 1.-fbmabs(p);
}

vec3 nor(in vec2 p)
{
	const vec2 e = vec2(0.002, 0.0);
	return -normalize(vec3(
		map(p + e.xy) - map(p - e.xy),
		map(p + e.yx) - map(p - e.yx),
		.15));
}

	
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	
	vec2 p = 2.*fragCoord.xy /iResolution.xy-1.;
    
	if(p.y>0.){
    	if(p.x>0.)windows =1;
    	else    windows =0;}
    else{
    	if(p.x>0.)windows =3;
        else windows =2;}
    //comment the following line to see windows
    windows =3;
    
      
    if(iMouse.z>0.)m = 2.*iMouse.xy/iResolution.xy-1.;
   	p += .2*m*iTime;
    vec3 light = normalize(vec3(3., 2., -1.));
	float r;
    r = max(dot(nor(p), light),0.25);
    float k=map(p)*.8+.15;
    fragColor = clamp(vec4(r, r, r, 1.0),0.,1.);
	fragColor = clamp(vec4(r*k*k, r*k, r*sqrt(k), 1.0),0.,1.);
}

https://www.shadertoy.com/view/MlsGDs

float time;

float noise(vec2 p)
{
  return sin(p.x*10.) * sin(p.y*(3. + sin(time/11.))) + .2; 
}

mat2 rotate(float angle)
{
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}


float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.;
  float amp = .5;
  for( int i = 0; i < 3; i++) {
    mat2 modify = rotate(time/50. * float(i*i));
    f += amp*noise(p);
    p = modify * p;
    p *= 2.;
    amp /= 2.2;
  }
  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  q = vec2( fbm(p + vec2(1.)), fbm(rotate(.1*time)*p + vec2(1.)));
  r = vec2( fbm(rotate(.1)*q + vec2(0.)), fbm(q + vec2(0.)));
  return fbm(p + 1.*r);

}

float digit(vec2 p){
    vec2 grid = vec2(3.,1.) * 15.;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q;
    vec2 r;
    float intensity = pattern(s/10., q, r)*1.3 - 0.03 ;
    p = fract(p);
    p *= vec2(1.2, 1.2);
    float x = fract(p.x * 5.);
    float y = fract((1. - p.y) * 5.);
    int i = int(floor((1. - p.y) * 5.));
    int j = int(floor(p.x * 5.));
    int n = (i-2)*(i-2)+(j-2)*(j-2);
    float f = float(n)/16.;
    float isOn = intensity - f > 0.1 ? 1. : 0.;
    return p.x <= 1. && p.y <= 1. ? isOn * (0.2 + y*4./5.) * (0.75 + x/4.) : 0.;
}

float hash(float x){
    return fract(sin(x*234.1)* 324.19 + sin(sin(x*3214.09) * 34.132 * x) + x * 234.12);
}

float onOff(float a, float b, float c)
{
	return step(c, sin(iTime + a*cos(iTime*b)));
}

float displace(vec2 look)
{
    float y = (look.y-mod(iTime/4.,1.));
    float window = 1./(1.+50.*y*y);
	return sin(look.y*20. + iTime)/80.*onOff(4.,2.,.8)*(1.+cos(iTime*60.))*window;
}

vec3 getColor(vec2 p){
    
    float bar = mod(p.y + time*20., 1.) < 0.2 ?  1.4  : 1.;
    p.x += displace(p);
    float middle = digit(p);
    float off = 0.002;
    float sum = 0.;
    for (float i = -1.; i < 2.; i+=1.){
        for (float j = -1.; j < 2.; j+=1.){
            sum += digit(p+vec2(off*i, off*j));
        }
    }
    return vec3(0.9)*middle + sum/10.*vec3(0.,1.,0.) * bar;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    time = iTime / 3.;
    vec2 p = fragCoord / iResolution.xy;
    float off = 0.0001;
    vec3 col = getColor(p);
    fragColor = vec4(col,1);
}

https://www.shadertoy.com/view/4l2GRz

//
// Description : *Noise Factor*
//      Author : lithozine (R.C.Hoetzlein, www.rchoetzlein.com)
//     Lastmod : 2015-03-17
//     License : Copyright (C) 2015 Creative Common Share Alike
//   Attribute : Parts based on "Array and textureless 3D noise", by Ian McEwan, MIT License

#define PERMUTE(x)  mod(((x*34.0)+1.0)*x, 289.0)

float noise (in vec3 v)
{   
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );  
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  i = mod(i, 289.0 ); 
  vec4 p = PERMUTE( PERMUTE( PERMUTE( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );  
  vec4 s0 = floor(b0)*2.0 + 1.0;  
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;  
  vec3 p0 = vec3(a0.xy,h.x);
  
  return p0.y;
}
 

vec3 map( in vec3 p, float scale, vec3 trans )
{
	float f = noise( (p-trans) * scale );    
    float v1 = clamp( -p.x + f, 0.0, 1.0 );			// half space
    float v2 = clamp(  p.x -3.0 - f, 0.0, 1.0 );	// ..the other half
    return vec3(v1,v2,0);
}

vec4 integrate( in vec4 sum, in float dens, in vec3 pos, in float t, float side )
{
    // simple alpha blend
    float a = 0.8;
    vec4 clr;
    clr = vec4(dens, dens, dens, 1.0);        
    clr.rgb *= a;    
    return sum + clr*(1.0-a);
}

// need lots of steps due to high freq
#define STEPS 2000

vec4 raymarch( in vec3 ro, in vec3 rd, in vec3 bgcol, float scale, vec3 trans )
{
	vec4 sum = vec4(0.0);

	float t = 0.3;
    for(int i=0; i<STEPS; i++) {
        vec3 pos = ro + t*rd;
        if ( sum.a > 0.99 ) break;
        vec3 dens = map( pos, scale, trans );                 
        if( dens.x > 0.0001 ) sum = integrate( sum, dens.x, pos, t,  1.0 );                 
        if( dens.y > 0.0001 ) sum = integrate( sum, dens.y, pos, t, -1.0 );
        t += max(0.005,0.005*t);    // small stepping due to high freq
    }

    return clamp( sum, 0.0, 1.0 );
}

mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

vec3 render( in vec3 ro, in vec3 rd, float scale, vec3 trans )
{
    vec3 clr;
    clr = raymarch( ro, rd, clr, scale, trans ).xyz;        
    return clr;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 m = iMouse.xy/iResolution.xy;  // no mouse interaction
    
    float time = float(iTime);
    float t = (time*1.25) / 8.0;
    float t2 = t*t;		// time accelerates
    
    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/ iResolution.y;    
    
    // camera
    m.x  = 0.5 + sin ( t2*0.30 ) * (0.3 + time*0.002) ;
    m.y  = 0.5 + cos ( t2*0.73 ) * 0.6;    
    vec3 ro = 2.0*normalize(vec3(sin(3.0*m.x), 2.0*m.y-1.0, cos(3.0*m.x) ));
	vec3 ta = vec3(0.0, 0.0, 0.0);
    mat3 ca = setCamera( ro, ta, 0.0 );

    // ray
    vec3 rd = ca * normalize( vec3(p.xy,1.5));
    
    // scale & translate animation
    float s = (cos (t2*0.2 )+1.0 )*200.0  + 5.0;
    vec3 tr =  vec3( -ro.x, t, 0);
    
    float v = pow( render( ro, rd, s, tr ).x*5.0, 1.6);  // gamma & brightness correction
    v = ( time > 55.0) ? v * (60.0-time)/5.0 : v;   // fade out
    
    fragColor = vec4(  v,v,v, 1.0 );
}

https://www.shadertoy.com/view/4tl3WN

#define NUM_DRIPS 20

float Seed;

void srand (float t)
{
    Seed = 0.5 + (sin (t*59.0) + sin (t*73.0) + sin (t*97.0))/6.0;
}
    
float rand()
{
    Seed = 0.25 + 0.5*Seed + 0.25*sin (12345.0 * Seed);
    return Seed;
}

vec2 dripPos (float fTime, out float fAge)
{
    float t = floor (fTime*0.1);
    srand (t);
    fAge = fTime*0.1 - t;
    return vec2 (rand(), rand());
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 vRel = fragCoord.xy / iResolution.xy;

    float t = iTime;
    float fStep = 123.456;
    float fHeight = 0.0;
    
    for (int i = 0; i < NUM_DRIPS; i++)
    {
        float fAge;
        vec2 vRnd = dripPos (t, fAge);

        // float fDx = vRel.x - vRnd.x;
        // float fDy = vRel.y - vRnd.y;
        // float fD2 = fDx*fDx + fDy*fDy;
        // float fD = sqrt (fD2);
        
        // the above, simpler:
        vec2 vD = vec2 (vRel - vRnd);
        float fD = sqrt (dot (vD, vD));

        float fDa = 10.0 * (fD - fAge + 0.6);

        fHeight += (1.0 - fAge) 
            * max (0.0, 1.0 - (fDa*fDa))
            * sin (fD*150.0 - fAge*80.0);
        
        t += fStep;
    }

    vRel.y -= sign (fHeight) * fHeight*fHeight;
    vec4 vTex = texture (iChannel0, vRel);

    if (fHeight < 0.0)
    {
        float p = -fHeight*0.8;
        float q = 1.0 - p;
        vTex.b = p + q*vTex.b;
        p = -fHeight*0.3;
        q = 1.0 - p;
        vTex.g = p + q*vTex.g;
    }
    
    fragColor = vTex; 
}

https://www.shadertoy.com/view/MlXGWM

// based on https://www.shadertoy.com/view/lsf3RH by
// trisomie21 (THANKS!)
// My apologies for the ugly code.

float snoise(vec3 uv, float res)	// by trisomie21
{
	const vec3 s = vec3(1e0, 1e2, 1e4);
	
	uv *= res;
	
	vec3 uv0 = floor(mod(uv, res))*s;
	vec3 uv1 = floor(mod(uv+vec3(1.), res))*s;
	
	vec3 f = fract(uv); f = f*f*(3.0-2.0*f);
	
	vec4 v = vec4(uv0.x+uv0.y+uv0.z, uv1.x+uv0.y+uv0.z,
		      	  uv0.x+uv1.y+uv0.z, uv1.x+uv1.y+uv0.z);
	
	vec4 r = fract(sin(v*1e-3)*1e5);
	float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	r = fract(sin((v + uv1.z - uv0.z)*1e-3)*1e5);
	float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	return mix(r0, r1, f.z)*2.-1.;
}

float brightness = 0.1;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    if( brightness < 0.15 ) {
        brightness	= max( ( cos(iTime) * 0.25 + sin(iTime) * 0.25 ), 0.1); 
    }
	float radius		= 0.24 + brightness * 0.2;
	float invRadius 	= 1.0/radius;
	
	vec3 orange			= vec3( 0.2, 0.65, 0.5 );
	vec3 orangeRed		= vec3( 0.1, 0.25, 0.81 );
	float time		= iTime * 0.1;
	float aspect	= iResolution.x/iResolution.y;
	vec2 uv			= fragCoord.xy / iResolution.xy;
	vec2 p 			= -0.5 + uv;
	p.x *= aspect;

	float fade		= pow( length( 2.0 * p ), 0.5 );
	float fVal1		= 1.0 - fade;
	float fVal2		= 1.0 - fade;
	
	float angle		= atan( p.x, p.y )/6.2832;
	float dist		= length(p);
	vec3 coord		= vec3( angle, dist, time * 0.1 );
	
	float newTime1	= abs( snoise( coord + vec3( 0.0, -time * ( 0.35 + brightness * 0.001 ), time * 0.015 ), 15.0 ) );
	float newTime2	= abs( snoise( coord + vec3( 0.0, -time * ( 0.15 + brightness * 0.001 ), time * 0.015 ), 45.0 ) );	
	for( int i=1; i<=7; i++ ){
		float power = pow( 2.0, float(i + 1) );
		fVal1 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 10.0 ) * ( newTime1 + 1.0 ) ) );
		fVal2 += ( 0.5 / power ) * snoise( coord + vec3( 0.0, -time, time * 0.2 ), ( power * ( 25.0 ) * ( newTime2 + 1.0 ) ) );
	}
	
	float corona		= pow( fVal1 * max( 1.1 - fade, 0.0 ), 2.0 ) * 50.0;
	corona				+= pow( fVal2 * max( 1.1 - fade, 0.0 ), 2.0 ) * 50.0;
	corona				*= 1.2 - newTime1;
	vec3 sphereNormal 	= vec3( 0.0, 0.0, 1.0 );
	vec3 dir 			= vec3( 0.0 );
	vec3 center			= vec3( 0.5, 0.5, 1.0 );
	vec3 starSphere		= vec3( 0.0 );
	
	vec2 sp = -1.0 + 2.0 * uv;
	sp.x *= aspect;
	sp *= ( 2.0 - brightness );
  	float r = dot(sp,sp);
	float f = (1.0-sqrt(abs(1.0-r)))/(r) + brightness * 0.5;
	if( dist < radius ){
		corona			*= pow( dist * invRadius, 24.0 );
  		vec2 newUv;
 		newUv.x = sp.x*f;
  		newUv.y = sp.y*f;
		newUv += vec2( time, 0.0 );
		
		vec3 texSample 	= texture( iChannel0, newUv ).rgb;
		float uOff		= ( texSample.g * brightness * 3.14 + time );
		vec2 starUV		= newUv + vec2( uOff, 0.0 );
		starSphere		= texture( iChannel0, starUV ).rgb;
	}
	
	float starGlow	= min( max( 1.0 - dist * ( 1.0 - brightness ), 0.0 ), 1.0 );
	//fragColor.rgb	= vec3( r );
	fragColor.rgb	= vec3( f * ( 0.75 + brightness * 0.3 ) * orange ) + starSphere + corona * orange + starGlow * orangeRed;
	fragColor.a		= 1.0;
}

https://www.shadertoy.com/view/XlX3RB

#define T(a) texture(iChannel0,p.xz*.1-t*a)
void mainImage( out vec4 o, in vec2 c ) {
    vec4 p = vec4(c,0.,1.)/iResolution.xyxy-.5, d=p, e;
    float t = iTime+6., x;
    d.y -= .2;
    p.z += t*.3;
    for(float i=1.; i>0.; i-=.02)
    {
        e = sin(p*6.+t);
        x = abs(p.y+e.x*e.z*.1-.75)-(e=T(.01)+T(.02)).x*.08;
        o = .3/length(p.xy+vec2(sin(t),-.4)) - e*i*i;
        if(x<.01) break;
        p -= d*x*.5;
     }
}

https://www.shadertoy.com/view/XlX3Rj

// This content is under the MIT License.

#define time iTime*.02


#define width .005
float zoom = .18;

float shape=0.;
vec3 color=vec3(0.),randcol;

void formula(vec2 z, float c) {
	float minit=0.;
	float o,ot2,ot=ot2=1000.;
	for (int i=0; i<9; i++) {
		z=abs(z)/clamp(dot(z,z),.1,.5)-c;
		float l=length(z);
		o=min(max(abs(min(z.x,z.y)),-l+.25),abs(l-.25));
		ot=min(ot,o);
		ot2=min(l*.1,ot2);
		minit=max(minit,float(i)*(1.-abs(sign(ot-o))));
	}
	minit+=1.;
	float w=width*minit*2.;
	float circ=pow(max(0.,w-ot2)/w,6.);
	shape+=max(pow(max(0.,w-ot)/w,.25),circ);
	vec3 col=normalize(.1+texture(iChannel1,vec2(minit*.1)).rgb);
	color+=col*(.4+mod(minit/9.-time*10.+ot2*2.,1.)*1.6);
	color+=vec3(1.,.7,.3)*circ*(10.-minit)*3.*smoothstep(0.,.5,.15+texture(iChannel0,vec2(.0,1.)).x-.5);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 pos = fragCoord.xy / iResolution.xy - .5;
	pos.x*=iResolution.x/iResolution.y;
	vec2 uv=pos;
	float sph = length(uv); sph = sqrt(1. - sph*sph)*1.5; 
	uv=normalize(vec3(uv,sph)).xy;
	float a=time+mod(time,1.)*.5;
	vec2 luv=uv;
	float b=a*5.48535;
	uv*=mat2(cos(b),sin(b),-sin(b),cos(b));
	uv+=vec2(sin(a),cos(a*.5))*8.;
	uv*=zoom;
	float pix=.5/iResolution.x*zoom/sph;
	float dof=max(1.,(10.-mod(time,1.)/.01));
	float c=1.5+mod(floor(time),6.)*.125;
	for (int aa=0; aa<36; aa++) {
		vec2 aauv=floor(vec2(float(aa)/6.,mod(float(aa),6.)));
		formula(uv+aauv*pix*dof,c);
	}
	shape/=36.; color/=36.;
	vec3 colo=mix(vec3(.15),color,shape)*(1.-length(pos))*min(1.,abs(.5-mod(time+.5,1.))*10.);	
	colo*=vec3(1.2,1.1,1.0);
	fragColor = vec4(colo,1.0);
}

https://www.shadertoy.com/view/Mll3zj

// Star Nest by Pablo RomÃ¡n Andrioli

// This content is under the MIT License.

// Original post by Kali https://www.shadertoy.com/view/XlfGRj

#define iterations 17
#define formuparam 0.53

#define volsteps 20
#define stepsize 0.1

#define zoom   0.800
#define tile   0.850
#define speed  0.002 

#define brightness 0.002
#define darkmatter 0.300
#define distfading 0.750
#define saturation 0.750

float SCurve (float value) {
    if (value < 0.5)
    {
        return value * value * value * value * value * 16.0; 
    }
    
    value -= 1.0;
    
    return value * value * value * value * value * 16.0 + 1.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	//get coords and direction
	vec2 uv=fragCoord.xy/iResolution.xy-.5;
	uv.y*=iResolution.y/iResolution.x;
	vec3 dir=vec3(uv*zoom,1.);
	float time=iTime*speed+.25;

	//mouse rotation
	float a1=.5+iMouse.x/iResolution.x*2.;
	float a2=.8+iMouse.y/iResolution.y*2.;
	mat2 rot1=mat2(cos(a1),sin(a1),-sin(a1),cos(a1));
	mat2 rot2=mat2(cos(a2),sin(a2),-sin(a2),cos(a2));
	dir.xz*=rot1;
	dir.xy*=rot2;
	vec3 from=vec3(1.,.5,0.5);
	from+=vec3(time*2.,time,-2.);
	from.xz*=rot1;
	from.xy*=rot2;
	
	//volumetric rendering
	float s=0.1,fade=1.;
	vec3 v=vec3(0.);
	for (int r=0; r<volsteps; r++) {
		vec3 p=from+s*dir*.5;
		p = abs(vec3(tile)-mod(p,vec3(tile*2.))); // tiling fold
		float pa,a=pa=0.;
		for (int i=0; i<iterations; i++) { 
			p=abs(p)/dot(p,p)-formuparam; // the magic formula
			a+=abs(length(p)-pa); // absolute sum of average change
			pa=length(p);
		}
		float dm=max(0.,darkmatter-a*a*.001); //dark matter
		a = pow(a, 2.5); // add contrast
		if (r>6) fade*=1.-dm; // dark matter, don't render near
		//v+=vec3(dm,dm*.5,0.);
		v+=fade;
		v+=vec3(s,s*s,s*s*s*s)*a*brightness*fade; // coloring based on distance
		fade*=distfading; // distance fading
		s+=stepsize;
	}
    
	v=mix(vec3(length(v)),v,saturation); //color adjust
    
    vec4 C = vec4(v*.01,1.);
    
     	C.r = pow(C.r, 0.35); 
 	 	C.g = pow(C.g, 0.36); 
 	 	C.b = pow(C.b, 0.4); 
 	
    vec4 L = C;   	
    
    	C.r = mix(L.r, SCurve(C.r), 1.0); 
    	C.g = mix(L.g, SCurve(C.g), 0.9); 
    	C.b = mix(L.b, SCurve(C.b), 0.6);     	
    
	fragColor = C;	
	
}

https://www.shadertoy.com/view/XlfGzX

//More Spirograph by eiffie
//Trying (and failing) to make a better DE for parameterized curves.

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec3 col=texture(iChannel0,fragCoord/iResolution.xy).rgb;
    fragColor=vec4(col,1.0);
}

//More Spirograph by eiffie
//Trying (and failing) to make a better DE for parameterized curves.

#define STEPS 50
#define ITERS 9

float scale;
float Config(float t){
	float sgn=1.0;
	if(mod(t,54.0)>27.0)sgn=-1.0;
	t=floor(mod(t,27.0));
	if(t<10.0)
        return (2.0+t*0.25)*sgn;
	t-=10.0;
	if(t<10.0)return (2.0+t*0.33333)*sgn;
	t-=10.0;
    if(t<1.0)return 3.82845*sgn; //I have no idea what this pattern is (similar to note freq)
	if(t<2.0)return 3.64575*sgn; //these give the regular polygons
	if(t<3.0)return 3.44955*sgn;
	if(t<4.0)return 2.7913*sgn;
	if(t<5.0)return 2.5616*sgn;
	if(t<6.0)return 2.4495*sgn;
	return 2.30275*sgn;
}
vec2 F(float t){
	float a=t,r=1.0;
	vec2 q=vec2(0.0);
	for(int j=0;j<ITERS;j++){
		q+=vec2(cos(a),sin(a))*r;
		a*=scale;r/=abs(scale);
	}
	return q;
}
vec2 DF(vec2 p, float t){
    float d1=length(p-F(t)),dt=0.1*d1,d2=length(p-F(t+dt));
	dt/=max(dt,d1-d2);
	return vec2(min(d1,d2),0.4*log(d1*dt+1.0));
}
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec3 col=texture(iChannel0,fragCoord/iResolution.xy).rgb;
	vec2 p=(2.0*fragCoord.xy-iResolution.xy)/iResolution.y;
	p*=1.75;
    float tim=(iTime+99.0)*0.2;
	scale=Config(tim);//mix(Config(tim),Config(tim+1.0),smoothstep(0.5,1.0,fract(tim)));
	float t=iTime*100.0,d=100.0;
	for(int i=0;i<STEPS;i++){
		vec2 v=DF(p,t);
		d=min(d,v.x);
		t+=v.y;
	}
	d=smoothstep(0.0,0.01,d);
	col=mix(min(col,vec3(d*d*d,d*d,d)),vec3(1.0),0.01);
	fragColor = vec4(col,1.0);
}

https://www.shadertoy.com/view/MtlGR2

#define thank you eiffie :D 
#define and greetings to Kali :)
#define and_long_overdue thank_you iq
#define your_publications_where_a_greater_impact_than_sep11


// More Kali-de explorations 
// please by kind to this set
// License aGPL v3
// 2015, stefan berke 


// http://www.musicdsp.org/showone.php?id=238
float Tanh(in float x) { return clamp(x * ( 27. + x * x ) / ( 27. + 9. * x * x ), -1., 1.); }

// two different traps and colorings
#define mph (.5 + .5 * Tanh(sin(iTime/9.123+1.2)*7.))


vec3 kali_sky(in vec3 pos, in vec3 dir)
{
	vec4 col = vec4(0,0,0,1);
	
	float t = 0., pln;
    for (int k=0; k<50; ++k)
	{
		vec4 p = vec4(pos + t * dir, 1.);

		vec3 param = mix(
            vec3(1., .5, 1.),
			vec3(.51, .5, 1.+0.1*mph), mph);

        // "kali-set" by Kali
		float d = 10.; pln=6.;
        vec3 av = vec3(0.);
		for (int i=0; i<6; ++i)
		{
            p = abs(p) / dot(p.xyz, p.xyz);
            // distance to tretrahedron / cylinder
            d = min(d, mix(p.x+p.y+p.z, length(p.xy), mph) / p.w);
            // disc?
            if (i == 2)	pln = min(pln, dot(p.xyz, vec3(0,0,1)) / p.w);
			av += p.xyz/(4.+p.w);
            p.xyz -= param 
                // a little transition that makes it swim
                - 100.*col.x*mph*(1.-mph);
		}
        // blend the gems a bit 
		d += .03*(1.-mph)*smoothstep(0.1,0., t);
		if (d <= 0.0) break;
        // something like a light trap
		col.w = min(col.w, d);
        
#if 1
        // a few more steps for texture
        for (int i=0; i<3; ++i)
        {
            p = abs(p) / dot(p.xyz, p.xyz);
            av += p.xyz/(4.+p.w);
            p.xyz -= param;
        }
#endif        
        // (why are these values getting so large?) 
		col.xyz += av / 4000. + p.xyz / 40000.;
		
        // quadratic seems to work pretty good for the gems
        // well it's just a sum otherwise
		t += min(0.1, mix(d*d*1., d, mph));
	}
	
	return mix(col.xyz/col.w*(2.1-2.*mph)/(1.+.2*t), 
               mph-0.001/col.www - (1.-mph*0.8)*vec3(0.1,0.2,0.4)/(1.+pln), 
               mph);
}


vec2 rotate(in vec2 v, float r) { float s = sin(r), c = cos(r);	return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord.xy - iResolution.xy*.5) / iResolution.y * 2.;
    
    vec3 dir = normalize(vec3(uv, (.9+.2*mph) - 0.4*length(uv)));
    
    float t = iTime-2.;
	vec3 pos = vec3((1.-mph*.5)*sin(t/2.), (.3-.2*mph)*cos(t/2.), (.3+2.*mph)*(-1.+sin(t/4.13)));
    pos.xy *= 1.5 + sin(t/3.47) + 0.5 * -pos.z;
    dir.yz = rotate(dir.yz, -1.4+mph+(1.-.6*mph)*(-.5+0.5*sin(t/4.13+2.+1.*sin(t/1.75))));
    dir.xy = rotate(dir.xy, sin(t/2.)+0.2*sin(t+sin(t/3.)));
    
	fragColor = vec4(kali_sky(pos, dir), 1.);
}


