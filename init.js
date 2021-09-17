const getKnackDt = async(url)=>{
    try {
        const response = await fetch(url);
        const json = await response.json();
        return {
            javascript: json.application.settings.javascript,
            allData: json,
            scenes: json.application.scenes
        };
    } catch (error) {
        console.error(error);
    }
}

const extractViewsAndScenes = (sceneObj) =>{
    let views = [];
    let scenes = [];
    sceneObj.forEach(scene=>{
        scenes.push(scene.key);

        scene.views.forEach(view=>{
            views.push(view.key)
        })
    })

    return {views, scenes}
}

const decodeAndParse = (encodedData) =>{
    return decodeURIComponent(encodedData);
}

const findUsedScenesAndViews = (javascriptCode) =>{
    const viewRegex = /view_\d+/gi;
    const sceneRegex = /scene_\d+/gi;

    const allViews = javascriptCode.match(viewRegex);
    const allScenes = javascriptCode.match(sceneRegex);

    const viewsSet = new Set(allViews);
    const sceneSet = new Set(allScenes);
    
    return ({viewsSet, sceneSet})
}

const findBadScenesAndViews = (usedScenesAndViews, allExistingScenesAndViews) =>{
    const {viewsSet:viewsFoundInCode, sceneSet: scenesFoundInCode} = usedScenesAndViews;
    const {views: existingViews, scenes: existingScenes} = allExistingScenesAndViews;

    let badViews = [];
    let badScenes = [];

    viewsFoundInCode.forEach(view=>{
        if(existingViews.indexOf(view) === -1){
            badViews.push(view);
        }
    })

    scenesFoundInCode.forEach(scene=>{
        if(existingScenes.indexOf(scene) === -1){
            badScenes.push(scene);
        }
    })

    if(!badViews.length) badViews = ["None"]
    if(!badScenes.length) badScenes = ["None"]

    return {badViews, badScenes};
}

const findUnused = (knackData, js, path) => {
    const allExistingScenesAndViews = extractViewsAndScenes(knackData.scenes)

    const usedScenesAndViews = findUsedScenesAndViews(js);

    const badScenesAndViews = findBadScenesAndViews(usedScenesAndViews, allExistingScenesAndViews)

    return { [path] : badScenesAndViews}
}

const handleInnerScripts = async (jsCode, knackData) => {

    const urlRegex = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$].js|.js\?branch=.+?(?='))/igm

    const urls = jsCode.match(urlRegex)

    console.log('urls %o', urls);
    if(!urls || !urls.length) return [];


    let missing = [];
    //console.log(a);
    for (url of urls){
        try {
            const res = await fetch (url);
            if(!res.ok) {
                missing.push({[url] : {
                    badScenes: ["unable to resolve url"],
                    badViews: ["unable to resolve url"],
                }});
                continue;
            }
            const js = await res.text()
            missing.push(findUnused(knackData, js , url));

        } catch (error) {
            console.error('errpr in missing!')
            //missing.push("Couldn't get script!")
        }
      
    }

    return missing;

}
document.getElementById("appId").value = "5e16043735e3ac00159292e0"

const init = async(appId) =>{
    let url = `https://api.knack.com/v1/applications/${appId}`;
    const knackData= await getKnackDt(url);
    //console.log(knackData);

    if(!knackData.javascript){
        alert("No JavaScript Code Detected!")
        return false;
    } 
    const knackJavascript = decodeAndParse(knackData.javascript)

    const unused = [];

    //handle main script
    unused.push(findUnused(knackData, knackData.javascript, "Knack JS code module"))
    
    //handle inner scripts
    const innerScriptsResults = await handleInnerScripts(knackJavascript, knackData);

    unused.push(...innerScriptsResults);

    return unused;
    
};

//handle html
document.getElementById("submitBtn").addEventListener('click', async function(){
    document.getElementById('loading').style.display = "block";
    const results = await init(document.getElementById("appId").value)

    if(!results) return;

    document.getElementById('loading').style.display = "none";

    console.log('got results %o', results);

    let tbl = '';
    results.forEach(record=>{
        let firstItem = Object.keys(record)[0];
        let badViews = record[firstItem].badViews.join(", ");
        let badScenes = record[firstItem].badScenes.join(", ");
        tbl += `
        <tr>
            <td>   
                ${Object.keys(record)}
            </td>
            <td>${badViews}</td>
            <td>${badScenes}</td>
        </tr>
        `
    })

    document.getElementById("tableBody").innerHTML = tbl;

    console.log(tbl);
})