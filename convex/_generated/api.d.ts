export const api: any = {
  canvases: {
    getCanvas: "canvases:getCanvas",
    getCanvasByPublicToken: "canvases:getCanvasByPublicToken",
    createCanvas: "canvases:createCanvas",
    listMyCanvases: "canvases:listMyCanvases",
    updateCanvasMeta: "canvases:updateCanvasMeta",
    setPublicView: "canvases:setPublicView",
    deleteCanvas: "canvases:deleteCanvas",
  },
  notes: {
    addNote: "notes:addNote",
    updateNote: "notes:updateNote",
    deleteNote: "notes:deleteNote",
    reorderNotes: "notes:reorderNotes",
  },
  stressTests: {
    runStressTest: "stressTests:runStressTest",
    getLatestStressTest: "stressTests:getLatestStressTest",
    listStressTests: "stressTests:listStressTests",
    saveStressTestResult: "stressTests:saveStressTestResult",
  },
  invites: {
    createInvite: "invites:createInvite",
    acceptInvite: "invites:acceptInvite",
    getInviteInfo: "invites:getInviteInfo",
    listInvites: "invites:listInvites",
  },
  presence: {
    heartbeat: "presence:heartbeat",
    getPresence: "presence:getPresence",
  },
};
export const internal: any = api;
