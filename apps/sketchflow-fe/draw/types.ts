export type Points = {
  x: number;
  y: number;
};

type Color = string;

export type ShapeStyle = {
  strokeColor: Color;//done
  fillColor: Color;//done

  strokeWidth: number;//done

  strokeStyle: "solid" | "dashed" | "dotted";//done
  fillStyle: "solid" | "cross-hatch" | "hachure"; 

  opacity: number;//done
}

export type HistoryAction =
  | {
      type: "add";
      shape: Shape;
    }
  | {
      type: "delete";
      shape: Shape;
    }
  | {
      type: "update";
      before: Shape;
      after: Shape;
    }
  | {
    type: "group-add";
    shapes: Shape[]
  }
  | {
    type: "group-delete";
    shapes: Shape[]
  }
  | {
    type: "group-update";
    before: Shape[];
    after: Shape[]
  };

export type BaseShape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "ellipse";
      radX: number;
      radY: number;
      centerX: number;
      centerY: number;
    }
  | {
      type: "diamond";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      top: number;
      left: number;
    }
  | {
      type: "line";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    }
  | {
      type: "pencil";
      points: Array<Points>;
    }
  | {
      type: "hand";
    }
  | {
      type: "arrow";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    };

export type Shape = BaseShape & ShapeStyle & {
  id: string;
};

export type Cursor = {
  x: number;
  y: number;
  color?: Color;
  name?: string;
}

export type Toast = {
  message : string;
  color : Color
}

export type SelectionBound = {
  x: number;
  y: number;
  width: number;
  height: number;
}

