import { Vector3, Matrix4, ShaderMaterial, ShaderLib, Mesh } from "three"

// SRC: This and the index.js file for this face filter library are from the repo
// https://github.com/jeeliz/jeelizFaceFilter.
// They've been modified from the original source code.

//
// Helper for THREE Fiber. You can customize it
//

const superThat = (() => {
  // internal settings:
  const _settings = {
    // negative -> look upper. in radians
    rotationOffsetX: 0,
    // YZ of the distance between the center of the cube and the pivot. enable _settings.isDebugPivotPoint to set this value
    pivotOffsetYZ: [0.2, 0.6],
    // sensibility, between 0 and 1. Less -> more sensitive
    detectionThreshold: 0.8,
    detectionHysteresis: 0.02,

    // tweakMoveYRotateX: 0,//0.5, // tweak value: move detection window along Y axis when rotate the face around X (look up <-> down)
    // Field of View for the smallest dimension of the video in degrees
    cameraMinVideoDimFov: 35,
  }

  let _threeFiberCompositeObjects = null
  let _threeProjMatrix = null

  const _previousSizing = {
    width: 1,
    height: -1,
  }

  let _threeTranslation = null
  let _maxFaces = -1
  let _detectCallback = null
  let _videoElement = null
  let _scaleW = 1
  let _canvasAspectRatio = -1

  const detect = (detectState) => {
    _threeFiberCompositeObjects.forEach((threeFiberCompositeObject, i) => {
      const threeCompositeObject = threeFiberCompositeObject

      if (!threeCompositeObject) return

      const isDetected = threeCompositeObject.visible
      const ds = detectState[i]

      if (
        isDetected &&
        ds.detected < _settings.detectionThreshold - _settings.detectionHysteresis
      ) {
        // DETECTION LOST
        if (_detectCallback) _detectCallback(i, false)

        threeCompositeObject.visible = false
      } else if (
        !isDetected &&
        ds.detected > _settings.detectionThreshold + _settings.detectionHysteresis
      ) {
        // FACE DETECTED
        if (_detectCallback) _detectCallback(i, true)

        threeCompositeObject.visible = true
      }
    }) // end loop on all detection slots
  }

  const update_poses = (ds, threeCamera) => {
    // tan( <horizontal FoV> / 2 ):
    const halfTanFOVX = Math.tan(
      (threeCamera.aspect * threeCamera.fov * Math.PI) / 360
    ) // tan(<horizontal FoV>/2), in radians (threeCamera.fov is vertical FoV)

    _threeFiberCompositeObjects.forEach(function (threeFiberCompositeObject, i) {
      const threeCompositeObject = threeFiberCompositeObject

      if (!threeCompositeObject) return

      if (!threeCompositeObject.visible) return

      const detectState = ds[i]

      // tweak Y position depending on rx:
      // const tweak = _settings.tweakMoveYRotateX * Math.tan(detectState.rx);
      const cz = Math.cos(detectState.rz)
      const sz = Math.sin(detectState.rz)

      // relative width of the detection window (1-> whole width of the detection window):
      const W = detectState.s * _scaleW

      // distance between the front face of the cube and the camera:
      const DFront = 1 / (2 * W * halfTanFOVX)

      // D is the distance between the center of the unit cube and the camera:
      const D = DFront + 0.5

      // coords in 2D of the center of the detection window in the viewport:
      const xv = detectState.x * _scaleW
      const yv = detectState.y * _scaleW

      // coords in 3D of the center of the cube (in the view coordinates system):
      // minus because view coordinate system Z goes backward
      const z = -D
      const x = xv * D * halfTanFOVX
      const y = (yv * D * halfTanFOVX) / _canvasAspectRatio

      // set position before pivot:
      threeCompositeObject.position.set(
        -sz * _settings.pivotOffsetYZ[0],
        -cz * _settings.pivotOffsetYZ[0],
        -_settings.pivotOffsetYZ[1]
      )

      // set rotation and apply it to position:
      threeCompositeObject.rotation.set(
        detectState.rx + _settings.rotationOffsetX,
        detectState.ry,
        detectState.rz,
        "ZYX"
      )
      threeCompositeObject.position.applyEuler(threeCompositeObject.rotation)

      // add translation part:
      _threeTranslation.set(
        x,
        y + _settings.pivotOffsetYZ[0],
        z + _settings.pivotOffsetYZ[1]
      )
      threeCompositeObject.position.add(_threeTranslation)
      // end loop on composite objects
    })
  }

  // public methods:
  return {
    init(spec, threeObjects, detectCallback) {
      _maxFaces = spec.maxFacesDetected
      _videoElement = spec.videoElement

      _threeFiberCompositeObjects = threeObjects

      if (typeof detectCallback !== "undefined") {
        _detectCallback = detectCallback
      }

      _threeTranslation = new Vector3()
      _threeProjMatrix = new Matrix4()
    },

    update(detectStates, threeCamera) {
      // update detection states then poses:
      detect(detectStates)
      update_poses(detectStates, threeCamera)
    },

    // create an occluder, IE a transparent object which writes on the depth buffer:
    create_occluder(occluderGeometry) {
      const occluderMaterial = new ShaderMaterial({
        vertexShader: ShaderLib.basic.vertexShader,

        fragmentShader:
          "precision lowp float;\n void main(void){\n gl_FragColor=vec4(1.,0.,0.,1.);\n }",

        uniforms: ShaderLib.basic.uniforms,
        colorWrite: false,
      })
      const occluderMesh = new Mesh(occluderGeometry, occluderMaterial)

      // render first
      occluderMesh.renderOrder = -1

      return occluderMesh
    },

    update_camera(sizing, threeCamera) {
      // not initialized
      if (_maxFaces === -1) return

      // reset camera position:
      if (threeCamera.matrixAutoUpdate) {
        threeCamera.matrixAutoUpdate = false
        threeCamera.position.set(0, 0, 0)
        threeCamera.updateMatrix()
      }

      // compute aspectRatio:
      const cvw = sizing.width
      const cvh = sizing.height

      _canvasAspectRatio = cvw / cvh

      // compute vertical field of view:
      const vw = _videoElement.videoWidth
      const vh = _videoElement.videoHeight
      const videoAspectRatio = vw / vh
      const fovFactor = vh > vw ? 1 / videoAspectRatio : 1
      const fov = _settings.cameraMinVideoDimFov * fovFactor

      // compute X and Y offsets in pixels:
      let scale = 1

      if (_canvasAspectRatio > videoAspectRatio) {
        // the canvas is more in landscape format than the video, so we crop top and bottom margins:
        scale = cvw / vw
      } else {
        // the canvas is more in portrait format than the video, so we crop right and left margins:
        scale = cvh / vh
      }

      const cvws = vw * scale
      const cvhs = vh * scale
      const offsetX = (cvws - cvw) / 2
      const offsetY = (cvhs - cvh) / 2

      _scaleW = cvw / cvws

      if (
        _previousSizing.width === sizing.width &&
        _previousSizing.height === sizing.height &&
        threeCamera.fov === fov &&
        threeCamera.view.offsetX === offsetX &&
        threeCamera.view.offsetY === offsetY &&
        threeCamera.projectionMatrix.equals(_threeProjMatrix)
      ) {
        // nothing changed
        return
      }

      Object.assign(_previousSizing, sizing)

      // apply parameters:
      threeCamera.aspect = _canvasAspectRatio
      threeCamera.fov = fov
      threeCamera.view = null
      console.log(
        "INFO in JeelizThreeFiberHelper.update_camera(): camera vertical estimated FoV is",
        fov,
        "deg"
      )
      threeCamera.setViewOffset(cvws, cvhs, offsetX, offsetY, cvw, cvh)
      threeCamera.updateProjectionMatrix()
      _threeProjMatrix.copy(threeCamera.projectionMatrix)
    },
  }
})()

const JeelizThreeFiberHelper = superThat

export default JeelizThreeFiberHelper
